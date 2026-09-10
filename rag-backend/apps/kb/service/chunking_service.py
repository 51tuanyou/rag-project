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

        if self.settings.get("qa_format", False):
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
                        }
                    )
            else:
                qa_chunks.append(
                    {
                        "id": f"qa_{len(qa_chunks) + 1}",
                        "content": qa_content,
                        "characters": len(qa_content),
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
            }
        ]

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
