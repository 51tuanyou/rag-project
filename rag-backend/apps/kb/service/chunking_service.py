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
        r"^(?P<num>\d+(?:\.\d+)*)\s+(?P<title>\S.{0,120}?)\s*$"
    )
    # Table-of-contents index lines: "5.1 测站基本属性表...... 5"
    _TOC_INDEX_LINE_RE = re.compile(r"[\.．…·•]{2,}\s*\d+\s*$")

    def _parse_toc_heading(self, line: str):
        """Return (num_tuple, title, full_label) or None if line is not a heading."""
        raw = (line or "").strip()
        if not raw or len(raw) > 160:
            return None
        # Skip catalogue/index lines — they create empty stub chunks without tables
        if self._TOC_INDEX_LINE_RE.search(raw):
            return None
        # Reject table-like / prose-heavy lines
        if raw.count("|") >= 2:
            return None
        if re.search(r"[：:。；;]", raw):
            return None
        # Reject schema / table data rows e.g. "1 测站编码 STCD C(8) N 1"
        tokens = re.split(r"\s+", raw)
        if len(tokens) >= 5:
            return None
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
        if not title or len(title) > 100:
            return None
        # Too many tokens in title → not a section heading
        if len(re.split(r"\s+", title)) > 8:
            return None
        try:
            num_tuple = tuple(int(x) for x in num_s.split("."))
        except ValueError:
            return None
        label = f"{num_s} {title}"
        return num_tuple, title, label

    def _is_toc_leaf(self, path: tuple, all_paths: List[tuple]) -> bool:
        """Leaf = no other heading has this path as a proper prefix."""
        return not any(
            len(other) > len(path) and other[: len(path)] == path for other in all_paths
        )

    def _dedupe_toc_chunks(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Keep the longest chunk per section label (prefer body over short duplicates)."""
        best: Dict[str, Dict[str, Any]] = {}
        order: List[str] = []
        for chunk in chunks:
            key = (chunk.get("embedding_text") or chunk.get("title") or chunk.get("id") or "").strip()
            if not key:
                key = chunk.get("id") or str(id(chunk))
            if key not in best:
                order.append(key)
                best[key] = chunk
            elif chunk.get("characters", 0) > best[key].get("characters", 0):
                best[key] = chunk
        # Drop near-empty stubs (heading line only)
        result = []
        for key in order:
            chunk = best[key]
            label = (chunk.get("embedding_text") or "").strip()
            body = (chunk.get("content") or "").strip()
            # Skip catalogue stubs: content is only the heading line
            body_lines = [ln for ln in body.splitlines() if ln.strip()]
            if label and len(body_lines) <= 1 and body_lines and label in body_lines[0]:
                continue
            result.append(chunk)
        # Re-number ids
        for i, chunk in enumerate(result, 1):
            chunk["id"] = f"toc_{i}"
        return result

    def _process_toc_document(self, text: str) -> List[Dict[str, Any]]:
        """
        Chunk by smallest (leaf) numbered directory/section headings.
        embedding_text / title = section name (used for vector search, like Q&A questions).
        content = full section body including the heading line.
        """
        lines = text.replace("\r\n", "\n").split("\n")
        headings = []  # {index, path, label, title}
        for i, line in enumerate(lines):
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

        all_paths = [h["path"] for h in headings]
        leaf_indices = [
            i for i, h in enumerate(headings) if self._is_toc_leaf(h["path"], all_paths)
        ]

        chunks: List[Dict[str, Any]] = []
        # Optional preamble before first heading (skip pure TOC pages)
        first_idx = headings[0]["index"]
        if first_idx > 0:
            preamble = "\n".join(lines[:first_idx]).strip()
            # Ignore short front-matter / catalogue leftovers
            if preamble and len(preamble) >= 80 and not re.search(r"目\s*次|contents", preamble[:40], re.I):
                chunks.append(
                    {
                        "id": f"toc_{len(chunks) + 1}",
                        "content": preamble,
                        "characters": len(preamble),
                        "embedding_text": preamble.split("\n", 1)[0][:200],
                        "title": preamble.split("\n", 1)[0][:80],
                    }
                )

        for h_i in leaf_indices:
            h = headings[h_i]
            start = h["index"]
            end = len(lines)
            for later in headings[h_i + 1 :]:
                end = later["index"]
                break
            body = "\n".join(lines[start:end]).strip()
            if not body:
                continue
            chunks.append(
                {
                    "id": f"toc_{len(chunks) + 1}",
                    "content": body,
                    "characters": len(body),
                    "embedding_text": h["label"],
                    "title": h["label"],
                }
            )

        chunks = self._dedupe_toc_chunks(chunks)
        print(f"Generated {len(chunks)} TOC leaf chunks from {len(headings)} headings ({len(leaf_indices)} leaves)")
        return chunks

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
