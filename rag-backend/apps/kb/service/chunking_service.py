"""
Document chunking service for processing documents into chunks
"""
import re
from typing import List, Dict, Any


class ChunkingService:
    def __init__(self, settings: Dict[str, Any]):
        self.settings = settings

    def process_document(self, document: str) -> List[Dict[str, Any]]:
        """Process document into chunks based on settings"""
        processed_text = self._preprocess_text(document)

        chunk_type = (self.settings.get("chunk_type") or "").strip().lower()
        if chunk_type == "toc" or self.settings.get("toc_format", False):
            chunks = self._process_toc_document(processed_text)
        elif chunk_type == "qa" or self.settings.get("qa_format", False):
            chunks = self._process_qa_document(processed_text)
        else:
            chunks = self._split_into_chunks(processed_text)

        return chunks

    def _preprocess_text(self, text: str) -> str:
        """Apply text pre-processing rules"""
        processed = text

        if self.settings.get("replace_spaces", True):
            # Keep newlines so PDF tables / multi-line structures are not flattened
            # into one long line (that caused mid-table chunk splits and missing rows).
            processed = re.sub(r"[^\S\n]+", " ", processed)
            processed = re.sub(r"\n{3,}", "\n\n", processed)

        if self.settings.get("delete_urls", False):
            processed = re.sub(
                r"http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+",
                "",
                processed,
            )
            processed = re.sub(
                r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
                "",
                processed,
            )

        return processed.strip()

    def _create_flag_pattern(self, flag: str, role: str = "question") -> str:
        """
        Build a regex for Q/A markers.

        Configured "Q:" / "问：" / "问题：" also match numbered forms:
        Q1:, 问2：, 问题3：, etc. Answer "A:" also matches 答： / 答案： / A1:.
        """
        flag = (flag or "").strip()
        if not flag:
            return r"(?!)"  # never matches

        punct_map = {
            ":": "[:：]",
            "：": "[:：]",
            "?": "[?？]",
            "？": "[?？]",
            "!": "[!！]",
            "！": "[!！]",
            ".": "[.。]",
            "。": "[.。]",
            ",": "[,，]",
            "，": "[,，]",
            ";": "[;；]",
            "；": "[;；]",
        }

        matched = re.match(
            r"^(?P<prefix>.+?)(?P<punct>[:：?？!！.。,，;；])\s*$",
            flag,
        )
        if matched:
            prefix = matched.group("prefix").strip()
            punct = matched.group("punct")
            punct_class = punct_map.get(punct, re.escape(punct))

            prefixes = [re.escape(prefix)]
            # Allow common bilingual / numbered Q&A aliases
            # e.g. Q: → Q1: / 问： / 问2： / 问题： / 问题1：
            question_aliases = {
                "Q",
                "QUESTION",
                "问",
                "问题",
            }
            answer_aliases = {
                "A",
                "ANSWER",
                "ANS",
                "答",
                "答案",
            }

            prefix_key = prefix.upper() if prefix.isascii() else prefix
            if role == "question" and (
                prefix_key in question_aliases or prefix in {"问", "问题"}
            ):
                for alias in ("Q", "问", "问题"):
                    prefixes.append(re.escape(alias))
            if role == "answer" and (
                prefix_key in answer_aliases or prefix in {"答", "答案"}
            ):
                for alias in ("A", "答", "答案"):
                    prefixes.append(re.escape(alias))

            seen = set()
            unique_prefixes = []
            for p in prefixes:
                if p not in seen:
                    seen.add(p)
                    unique_prefixes.append(p)
            # Longer first so "问题" wins over "问"
            unique_prefixes.sort(key=len, reverse=True)
            prefix_alt = "(?:" + "|".join(unique_prefixes) + ")"

            # Avoid matching Latin Q/A inside words like "FAQ1:"
            boundary = (
                r"(?<![A-Za-z0-9])"
                if prefix.isascii() and prefix.isalpha()
                else ""
            )
            # Optional digits: 问： / 问1： / 问题2： / Q12：
            return boundary + prefix_alt + r"\d*\s*" + punct_class

        pattern = re.escape(flag)
        for eng, pattern_repl in (
            (r"\:", "[:：]"),
            (r"\?", "[?？]"),
            (r"\!", "[!！]"),
        ):
            pattern = pattern.replace(eng, pattern_repl)
        return pattern

    def _process_qa_document(self, text: str) -> List[Dict[str, Any]]:
        """Process document for Q&A format"""
        question_flag = self.settings.get("question_flag", "Q: ").strip()
        answer_flag = self.settings.get("answer_flag", "A: ").strip()
        max_length = int(self.settings.get("qa_max_length", 1024))

        print(
            f"Q&A processing settings: question_flag='{question_flag}', "
            f"answer_flag='{answer_flag}', max_length={max_length}"
        )

        question_pattern = self._create_flag_pattern(question_flag, role="question")
        answer_pattern = self._create_flag_pattern(answer_flag, role="answer")
        print(f"Q&A regex: question=/{question_pattern}/ answer=/{answer_pattern}/")

        qa_chunks = []
        question_matches = list(re.finditer(question_pattern, text))

        if not question_matches:
            return [
                {
                    "id": "qa_1",
                    "content": text.strip(),
                    "characters": len(text.strip()),
                }
            ]

        for i, match in enumerate(question_matches):
            question_start = match.start()
            question_text = match.group()

            if i + 1 < len(question_matches):
                next_question_start = question_matches[i + 1].start()
                qa_block = text[question_start:next_question_start]
            else:
                qa_block = text[question_start:]

            answer_match = re.search(answer_pattern, qa_block)
            if not answer_match:
                continue

            answer_start = answer_match.start()
            question_part = qa_block[:answer_start].strip()
            answer_flag_text = answer_match.group()
            answer_part = qa_block[answer_start + len(answer_flag_text) :].strip()

            question = question_part.replace(question_text, "", 1).strip()
            answer = answer_part.strip()

            if not (question and answer):
                continue

            # Keep original document markers (e.g. Q1： / 答：), not "Question:" / "Answer:"
            qa_content = f"{question_text}{question}\n{answer_flag_text}{answer}"
            if len(qa_content) > max_length:
                words = qa_content.split()
                temp_chunk = ""

                for word in words:
                    if len(temp_chunk) + len(word) + 1 > max_length:
                        if temp_chunk:
                            qa_chunks.append(
                                {
                                    "id": f"qa_{len(qa_chunks) + 1}",
                                    "content": temp_chunk.strip(),
                                    "characters": len(temp_chunk.strip()),
                                    "embedding_text": question,
                                    "title": question,
                                }
                            )
                        temp_chunk = word
                    else:
                        temp_chunk = f"{temp_chunk} {word}".strip() if temp_chunk else word

                if temp_chunk:
                    qa_chunks.append(
                        {
                            "id": f"qa_{len(qa_chunks) + 1}",
                            "content": temp_chunk.strip(),
                            "characters": len(temp_chunk.strip()),
                            "embedding_text": question,
                            "title": question,
                        }
                    )
            else:
                qa_chunks.append(
                    {
                        "id": f"qa_{len(qa_chunks) + 1}",
                        "content": qa_content,
                        "characters": len(qa_content),
                        "embedding_text": question,
                        "title": question,
                    }
                )

        print(f"Generated {len(qa_chunks)} Q&A chunks")
        for chunk in qa_chunks:
            print(f"  {chunk['id']}: {chunk['characters']} characters")

        return qa_chunks if qa_chunks else [
            {
                "id": "qa_1",
                "content": text.strip(),
                "characters": len(text.strip()),
                "embedding_text": text.strip()[:200],
                "title": "",
            }
        ]

    # Numbered section headings: "1 范围", "3.1 一般规定", "8.5 水位流量…"
    # Generic (not language-specific): leading numeric path + short title line.
    _TOC_HEADING_RE = re.compile(
        r"^(?P<num>\d+(?:\.\d+)*)\s+(?P<title>\S.{0,180}?)\s*$"
    )
    # Table-of-contents index lines: "5.1 测站基本属性表...... 5"
    _TOC_INDEX_LINE_RE = re.compile(r"[\.．…·•]{2,}\s*\d+\s*$")
    # "表1 表标识符分类后缀取值表" — a caption, not a cross-reference ("见表 1").
    _TABLE_CAPTION_RE = re.compile(r"^表\s*\d+\s+\S")
    _DOTTED_SECTION_RE = re.compile(r"^\d+(?:\.\d+)+\s+\S")
    _BARE_NUM_LINE_RE = re.compile(r"^(?P<num>\d+)\s+(?P<title>\S.*?)\s*$")
    _PAGE_MARK_RE = re.compile(r"^SL\s*\d+(?:-\d+)?$", re.IGNORECASE)

    def _parse_toc_heading(self, line: str):
        """Return (num_tuple, title, full_label) or None if line is not a heading."""
        raw = (line or "").strip()
        if not raw or len(raw) > 200:
            return None
        # Skip catalogue/index lines — they create empty stub chunks without tables
        if self._TOC_INDEX_LINE_RE.search(raw):
            return None
        # A page number glued to the next line: "17 表16 …", "19 11", "82 9 交换信息类表结构"
        if re.match(r"^\d+\s+表\s*\d+", raw) or re.match(r"^\d+\s+\d+(\s|$)", raw):
            return None
        # Reject table-like lines
        if raw.count("|") >= 2:
            return None
        # Reject schema / table data rows e.g. "1 测站编码 STCD C(8) N 1"
        tokens = re.split(r"\s+", raw)
        if any(re.match(r"^[A-Za-z]{1,4}\(\d", t) for t in tokens):
            return None
        if any(t.upper() in {"DATETIME", "VARCHAR", "INTEGER", "BOOLEAN", "FLOAT", "DOUBLE"} for t in tokens):
            return None
        # ALL-CAPS field ids (STCD, MYDAVZ) with several tokens → table row, not a section title
        if len(tokens) >= 4 and any(re.fullmatch(r"[A-Z][A-Z0-9_]{1,}", t or "") for t in tokens[1:]):
            return None

        m = self._TOC_HEADING_RE.match(raw)
        if not m:
            return None
        num_s = m.group("num")
        title = m.group("title").strip()
        title = re.sub(r"[\.．…·•\s]+\d*$", "", title).strip()
        if not title or len(title) > 160:
            return None
        # A bare number ("3 河流名称 …") collides with table rows. Multi-level
        # numbers ("3.1.1", "3.2.7") are section clauses; PDF text often inserts
        # spaces and a trailing "。" into those lines.
        has_dot = "." in num_s
        if not has_dot and len(tokens) >= 5:
            return None
        if not has_dot and re.search(r"[：:。；;]", raw):
            return None
        # Wrapped body lines often start with a bare number ("2 地下水……共77张表。").
        # Real chapter titles are short.
        if not has_dot and (len(title) > 24 or len(re.split(r"\s+", title)) > 6):
            return None
        try:
            num_tuple = tuple(int(x) for x in num_s.split("."))
        except ValueError:
            return None
        label = f"{num_s} {title}"
        return num_tuple, title, label

    def _dedupe_toc_chunks(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Drop only exact content duplicates. Different bodies that share a label are kept."""
        seen = set()
        result = []
        for chunk in chunks:
            content = (chunk.get("content") or "").strip()
            if not content or content in seen:
                continue
            seen.add(content)
            result.append(chunk)
        for i, chunk in enumerate(result, 1):
            chunk["id"] = f"toc_{i}"
        return result

    def _process_toc_document(self, text: str) -> List[Dict[str, Any]]:
        """
        Chunk at the configured directory depth (default 3, max 6).
        Headings deeper than that stay inside the level-N chunk.
        A shallower heading that has children at level N is not its own chunk;
        it is written into the nearest level-N chunk. A shallower heading with
        no level-N descendant stays its own chunk so its body is not abandoned.
        """
        lines = text.replace("\r\n", "\n").split("\n")
        table_rows = self._table_body_indexes(lines)
        headings = []  # {index, path, label, title}
        for i, line in enumerate(lines):
            if i in table_rows:
                continue
            parsed = self._parse_toc_heading(line)
            if not parsed:
                continue
            path, title, label = parsed
            headings.append({"index": i, "path": path, "title": title, "label": label})

        if not headings:
            body = text.strip()
            return [
                {
                    "id": "toc_1",
                    "content": body,
                    "characters": len(body),
                    "embedding_text": body[:200] if body else "",
                    "title": "",
                }
            ] if body else []

        level = self._toc_level()
        anchor_positions = [
            i for i in range(len(headings)) if self._is_toc_anchor(headings, i, level)
        ]
        if not anchor_positions:
            body = text.strip()
            return [
                {
                    "id": "toc_1",
                    "content": body,
                    "characters": len(body),
                    "embedding_text": body[:200] if body else "",
                    "title": "",
                }
            ] if body else []

        starts = []
        for n, ai in enumerate(anchor_positions):
            anchor = headings[ai]
            if n == 0:
                starts.append(0)
                continue
            start = anchor["index"]
            prev_ai = anchor_positions[n - 1]
            for mid in headings[prev_ai + 1 : ai]:
                # Parent of this anchor (e.g. "3.2 基本内容" before "3.2.1")
                # opens the chunk so it is not left in the previous section.
                if (
                    len(mid["path"]) < len(anchor["path"])
                    and anchor["path"][: len(mid["path"])] == mid["path"]
                ):
                    start = mid["index"]
                    break
            starts.append(start)

        chunks: List[Dict[str, Any]] = []
        for n, ai in enumerate(anchor_positions):
            start = starts[n]
            end = starts[n + 1] if n + 1 < len(starts) else len(lines)
            if end < start:
                end = start
            body = "\n".join(lines[start:end]).strip()
            if not body:
                continue
            anchor = headings[ai]
            chunks.append(
                {
                    "id": f"toc_{len(chunks) + 1}",
                    "content": body,
                    "characters": len(body),
                    "embedding_text": anchor["label"],
                    "title": anchor["label"],
                }
            )

        chunks = self._dedupe_toc_chunks(chunks)
        print(
            f"Generated {len(chunks)} TOC chunks at level {level} "
            f"from {len(headings)} headings ({len(anchor_positions)} anchors)"
        )
        return chunks

    def _table_body_indexes(self, lines: List[str]) -> set:
        """
        Line indexes that belong to a table body.

        PDF text has no table markers, and code-list rows such as
        "001 基本信息类 B" or "1 中央报汛站" match the section-heading pattern.
        Those rows stay in the section that contains the table instead of
        opening their own chunks.
        """
        masked = set()
        self._mask_caption_tables(lines, masked)
        self._mask_serial_runs(lines, masked)
        return masked

    def _mask_caption_tables(self, lines: List[str], masked: set) -> None:
        i = 0
        while i < len(lines):
            if not self._TABLE_CAPTION_RE.match(lines[i].strip()):
                i += 1
                continue
            end = min(len(lines), i + 160)
            j = i + 1
            while j < end:
                if self._line_ends_table(lines, j):
                    break
                masked.add(j)
                j += 1
            i = j if j > i else i + 1

    def _line_ends_table(self, lines: List[str], index: int) -> bool:
        raw = lines[index].strip()
        if not raw or self._PAGE_MARK_RE.match(raw):
            return False
        if self._DOTTED_SECTION_RE.match(raw) and not self._TOC_INDEX_LINE_RE.search(raw):
            return True
        if self._is_chapter_line(lines, index):
            return True
        # A paragraph, clause, or sentence after the last row. Header rows and
        # wrapped cells stay inside the table.
        if re.match(r"^\d+\s+\S", raw):
            return False
        if re.match(r"^表\s*\d+\s+\S", raw):
            return False
        if re.search(r"[。；：:]", raw) or raw.startswith(("——", "—", "其中")):
            return True
        if re.match(r"^\d+[)）]", raw):
            return True
        return len(raw) > 48

    def _is_chapter_line(self, lines: List[str], index: int) -> bool:
        """A bare '5 基本信息类表结构' line, not a one-column table row."""
        raw = lines[index].strip()
        match = self._BARE_NUM_LINE_RE.match(raw)
        if not match or self._TOC_INDEX_LINE_RE.search(raw):
            return False
        num_s = match.group("num")
        if len(num_s) > 1 and num_s.startswith("0"):
            return False
        if len(re.split(r"\s+", raw)) != 2:
            return False
        title = match.group("title")
        if len(title) > 40 or re.search(r"[。；;]", title):
            return False
        number = int(num_s)
        previous = self._neighbor_bare_number(lines, index, -1)
        following = self._neighbor_bare_number(lines, index, 1)
        if previous is not None and previous == number - 1:
            return False
        if following is not None and following == number + 1:
            return False
        return True

    def _neighbor_bare_number(self, lines: List[str], index: int, step: int):
        j = index + step
        while 0 <= j < len(lines):
            raw = lines[j].strip()
            if not raw or self._PAGE_MARK_RE.match(raw):
                j += step
                continue
            if self._DOTTED_SECTION_RE.match(raw):
                return None
            match = self._BARE_NUM_LINE_RE.match(raw)
            if not match:
                return None
            num_s = match.group("num")
            if len(num_s) > 1 and num_s.startswith("0"):
                return int(num_s)
            return int(num_s)
        return None

    def _mask_serial_runs(self, lines: List[str], masked: set) -> None:
        """Adjacent '1 … / 2 … / 3 …' or '001 … / 002 …' lines are table rows."""
        run: List[int] = []
        numbers: List[int] = []

        def flush() -> None:
            if len(run) >= 2 and all(numbers[k + 1] == numbers[k] + 1 for k in range(len(numbers) - 1)):
                masked.update(run)
                # A trailing code such as "0 其它" sits on the next line and is not N+1.
                nxt = run[-1] + 1
                if nxt < len(lines):
                    tail = lines[nxt].strip()
                    tail_match = self._BARE_NUM_LINE_RE.match(tail)
                    if tail_match and len(tail) <= 16:
                        masked.add(nxt)
            run.clear()
            numbers.clear()

        for i, line in enumerate(lines):
            raw = line.strip()
            if not raw or self._PAGE_MARK_RE.match(raw):
                continue
            if self._DOTTED_SECTION_RE.match(raw) or self._TOC_INDEX_LINE_RE.search(raw):
                flush()
                continue
            match = self._BARE_NUM_LINE_RE.match(raw)
            if not match:
                flush()
                continue
            num_s = match.group("num")
            # A real clause immediately followed by "N.1" is not a table row.
            nxt = self._next_substantive(lines, i)
            if nxt and re.match(rf"^{int(num_s)}\.\d+\s+", nxt) and not (len(num_s) > 1 and num_s.startswith("0")):
                flush()
                continue
            if run and int(num_s) != numbers[-1] + 1:
                flush()
            run.append(i)
            numbers.append(int(num_s))
        flush()

    def _next_substantive(self, lines: List[str], index: int):
        j = index + 1
        while j < len(lines):
            raw = lines[j].strip()
            if raw and not self._PAGE_MARK_RE.match(raw):
                return raw
            j += 1
        return ""

    def _is_toc_anchor(self, headings: List[Dict[str, Any]], index: int, level: int) -> bool:
        """True when this heading should open its own chunk at the chosen depth."""
        path = headings[index]["path"]
        depth = len(path)
        if depth > level:
            return False
        if depth == level:
            return True
        # Shallower section: keep it only when nothing under it reaches `level`.
        for other in headings[index + 1 :]:
            other_path = other["path"]
            if len(other_path) <= depth or other_path[:depth] != path:
                break
            if len(other_path) >= level:
                return False
        return True

    def _toc_level(self) -> int:
        raw = self.settings.get("toc_level", self.settings.get("tocLevel", 3))
        try:
            level = int(raw)
        except (TypeError, ValueError):
            level = 3
        return max(1, min(6, level))

    def _split_into_chunks(self, text: str) -> List[Dict[str, Any]]:
        """Split text into chunks based on delimiter and length settings"""
        delimiter = self.settings.get("delimiter", "\n\n")
        # Unescape common UI-encoded newlines
        if isinstance(delimiter, str):
            delimiter = delimiter.replace("\\n", "\n")
        max_length = int(self.settings.get("max_length", 1024))
        overlap = int(self.settings.get("overlap", 50))

        print(
            f"Chunking settings: delimiter={delimiter!r}, "
            f"max_length={max_length}, overlap={overlap}"
        )

        segments = text.split(delimiter) if delimiter else [text]
        chunks = []
        chunk_id = 1
        current_chunk = ""

        def flush_current():
            nonlocal current_chunk, chunk_id
            if current_chunk.strip():
                chunks.append(
                    {
                        "id": f"Chunk-{chunk_id}",
                        "content": current_chunk.strip(),
                        "characters": len(current_chunk.strip()),
                    }
                )
                chunk_id += 1
            current_chunk = ""

        def append_with_newline(base: str, addition: str) -> str:
            if not base:
                return addition
            if not addition:
                return base
            return f"{base.rstrip()}\n\n{addition.lstrip()}"

        for segment in segments:
            segment = segment.strip()
            if not segment:
                continue

            if len(current_chunk) + len(segment) + 2 > max_length:
                if current_chunk:
                    flush_current()

                if len(segment) > max_length:
                    # Prefer line-based splits to keep table rows intact
                    lines = segment.split("\n")
                    temp_chunk = ""
                    for line in lines:
                        candidate = f"{temp_chunk}\n{line}".strip() if temp_chunk else line
                        if len(candidate) > max_length and temp_chunk:
                            chunks.append(
                                {
                                    "id": f"Chunk-{chunk_id}",
                                    "content": temp_chunk.strip(),
                                    "characters": len(temp_chunk.strip()),
                                }
                            )
                            chunk_id += 1
                            if overlap > 0:
                                overlap_text = (
                                    temp_chunk[-overlap:]
                                    if len(temp_chunk) > overlap
                                    else temp_chunk
                                )
                                temp_chunk = f"{overlap_text}\n{line}".strip()
                            else:
                                temp_chunk = line
                        else:
                            temp_chunk = candidate
                    current_chunk = temp_chunk
                else:
                    current_chunk = segment
            else:
                current_chunk = append_with_newline(current_chunk, segment)

        if current_chunk:
            flush_current()

        print(f"Generated {len(chunks)} chunks")
        for chunk in chunks:
            print(f"  {chunk['id']}: {chunk['characters']} characters")

        return chunks

    def _apply_qa_format(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Apply Q&A format to chunks if enabled"""
        if not self.settings.get("qa_format", False):
            return chunks

        question_flag = self.settings.get("question_flag", "Q: ").strip()
        answer_flag = self.settings.get("answer_flag", "A: ").strip()

        question_pattern = self._create_flag_pattern(question_flag, role="question")
        answer_pattern = self._create_flag_pattern(answer_flag, role="answer")

        qa_chunks = []
        for chunk in chunks:
            content = chunk["content"]
            question_matches = list(re.finditer(question_pattern, content))

            if not question_matches:
                qa_chunks.append(chunk)
                continue

            for i, match in enumerate(question_matches):
                question_start = match.start()
                question_text = match.group()

                if i + 1 < len(question_matches):
                    next_question_start = question_matches[i + 1].start()
                    qa_block = content[question_start:next_question_start]
                else:
                    qa_block = content[question_start:]

                answer_match = re.search(answer_pattern, qa_block)
                if not answer_match:
                    continue

                answer_start = answer_match.start()
                question_part = qa_block[:answer_start].strip()
                answer_flag_text = answer_match.group()
                answer_part = qa_block[answer_start + len(answer_flag_text) :].strip()

                question = question_part.replace(question_text, "", 1).strip()
                answer = answer_part.strip()

                if question and answer:
                    qa_content = f"{question_text}{question}\n{answer_flag_text}{answer}"
                    qa_chunks.append(
                        {
                            "id": f"qa_{len(qa_chunks) + 1}",
                            "content": qa_content,
                            "characters": len(qa_content),
                        }
                    )

        return qa_chunks if qa_chunks else chunks
