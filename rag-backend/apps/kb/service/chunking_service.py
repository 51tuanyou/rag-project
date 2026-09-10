"""
Document chunking service for processing documents into chunks
"""
import re
import json
from typing import List, Dict, Any


class ChunkingService:
    def __init__(self, settings: Dict[str, Any]):
        self.settings = settings
    
    def process_document(self, document: str) -> List[Dict[str, Any]]:
        """Process document into chunks based on settings"""
        # Apply text pre-processing
        processed_text = self._preprocess_text(document)
        
        # Check if Q&A format is enabled
        if self.settings.get('qa_format', False):
            # For Q&A format, process directly without splitting by delimiter
            chunks = self._process_qa_document(processed_text)
        else:
            # For regular format, split into chunks
            chunks = self._split_into_chunks(processed_text)
        
        return chunks
    
    def _preprocess_text(self, text: str) -> str:
        """Apply text pre-processing rules"""
        processed = text
        
        # Replace consecutive spaces, newlines and tabs
        if self.settings.get('replace_spaces', True):
            processed = re.sub(r'\s+', ' ', processed)
        
        # Delete URLs and email addresses
        if self.settings.get('delete_urls', False):
            processed = re.sub(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', '', processed)
            processed = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '', processed)
        
        return processed.strip()
    
    def _process_qa_document(self, text: str) -> List[Dict[str, Any]]:
        """Process document for Q&A format"""
        question_flag = self.settings.get('question_flag', 'Q: ').strip()
        answer_flag = self.settings.get('answer_flag', 'A: ').strip()
        max_length = int(self.settings.get('qa_max_length', 1024))
        
        print(f"Q&A processing settings: question_flag='{question_flag}', answer_flag='{answer_flag}', max_length={max_length}")
        
        # Create regex patterns for both Chinese and English punctuation
        def create_flag_pattern(flag):
            # Replace punctuation with both Chinese and English versions
            pattern = flag
            # Common punctuation mappings
            punct_map = {
                ':': '[:：]',  # English and Chinese colon
                '?': '[?？]',  # English and Chinese question mark
                '!': '[!！]',  # English and Chinese exclamation
                '.': '[.。]',  # English and Chinese period
                ',': '[,，]',  # English and Chinese comma
                ';': '[;；]',  # English and Chinese semicolon
            }
            
            for eng, pattern_repl in punct_map.items():
                if eng in pattern:
                    pattern = pattern.replace(eng, pattern_repl)
            
            return pattern
        
        question_pattern = create_flag_pattern(question_flag)
        answer_pattern = create_flag_pattern(answer_flag)
        
        qa_chunks = []
        
        # Find all question positions using regex
        import re
        question_matches = list(re.finditer(question_pattern, text))
        
        if not question_matches:
            # No Q&A format found, return as single chunk
            return [{
                'id': 'qa_1',
                'content': text.strip(),
                'characters': len(text.strip())
            }]
        
        # Process each Q&A block (from one question to the next)
        for i, match in enumerate(question_matches):
            question_start = match.start()
            question_text = match.group()
            
            # Find the end of this Q&A block
            if i + 1 < len(question_matches):
                # Next question starts here
                next_question_start = question_matches[i + 1].start()
                qa_block = text[question_start:next_question_start]
            else:
                # This is the last question, go to end of content
                qa_block = text[question_start:]
            
            # Find answer flag in this block
            answer_match = re.search(answer_pattern, qa_block)
            if answer_match:
                answer_start = answer_match.start()
                question_part = qa_block[:answer_start].strip()
                answer_part = qa_block[answer_start + len(answer_match.group()):].strip()
                
                # Remove the question flag from question part
                question = question_part.replace(question_text, '', 1).strip()
                # Remove the answer flag from answer part  
                answer = answer_part.replace(answer_match.group(), '', 1).strip()
                
                if question and answer:
                    # Check if this Q&A pair exceeds max length
                    qa_content = f"Question: {question}\nAnswer: {answer}"
                    if len(qa_content) > max_length:
                        # Split long Q&A into smaller chunks
                        words = qa_content.split()
                        temp_chunk = ""
                        
                        for word in words:
                            if len(temp_chunk) + len(word) + 1 > max_length:
                                if temp_chunk:
                                    qa_chunks.append({
                                        'id': f"qa_{len(qa_chunks) + 1}",
                                        'content': temp_chunk.strip(),
                                        'characters': len(temp_chunk.strip())
                                    })
                                temp_chunk = word
                            else:
                                if temp_chunk:
                                    temp_chunk += " " + word
                                else:
                                    temp_chunk = word
                        
                        # Add final chunk
                        if temp_chunk:
                            qa_chunks.append({
                                'id': f"qa_{len(qa_chunks) + 1}",
                                'content': temp_chunk.strip(),
                                'characters': len(temp_chunk.strip())
                            })
                    else:
                        qa_chunks.append({
                            'id': f"qa_{len(qa_chunks) + 1}",
                            'content': qa_content,
                            'characters': len(qa_content)
                        })
        
        print(f"Generated {len(qa_chunks)} Q&A chunks")
        for chunk in qa_chunks:
            print(f"  {chunk['id']}: {chunk['characters']} characters")
        
        return qa_chunks if qa_chunks else [{
            'id': 'qa_1',
            'content': text.strip(),
            'characters': len(text.strip())
        }]
    
    def _split_into_chunks(self, text: str) -> List[Dict[str, Any]]:
        """Split text into chunks based on delimiter and length settings"""
        delimiter = self.settings.get('delimiter', '\n\n')
        max_length = int(self.settings.get('max_length', 1024))
        overlap = int(self.settings.get('overlap', 50))
        
        print(f"Chunking settings: delimiter='{delimiter}', max_length={max_length}, overlap={overlap}")
        
        # Split by delimiter first
        segments = text.split(delimiter)
        chunks = []
        chunk_id = 1
        
        current_chunk = ""
        
        for segment in segments:
            segment = segment.strip()
            if not segment:
                continue
            
            # If adding this segment would exceed max length
            if len(current_chunk) + len(segment) + 1 > max_length:
                if current_chunk:
                    chunks.append({
                        "id": f"Chunk-{chunk_id}",
                        "content": current_chunk.strip(),
                        "characters": len(current_chunk.strip())
                    })
                    chunk_id += 1
                
                # If the segment itself is longer than max_length, split it further
                if len(segment) > max_length:
                    # Split long segment into smaller chunks
                    words = segment.split()
                    temp_chunk = ""
                    
                    for word in words:
                        if len(temp_chunk) + len(word) + 1 > max_length:
                            if temp_chunk:
                                chunks.append({
                                    "id": f"Chunk-{chunk_id}",
                                    "content": temp_chunk.strip(),
                                    "characters": len(temp_chunk.strip())
                                })
                                chunk_id += 1
                            
                            # Start new chunk with overlap
                            if overlap > 0 and temp_chunk:
                                overlap_text = temp_chunk[-overlap:] if len(temp_chunk) > overlap else temp_chunk
                                temp_chunk = overlap_text + " " + word
                            else:
                                temp_chunk = word
                        else:
                            if temp_chunk:
                                temp_chunk += " " + word
                            else:
                                temp_chunk = word
                    
                    current_chunk = temp_chunk
                else:
                    # Start new chunk with overlap
                    if overlap > 0 and current_chunk:
                        overlap_text = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                        current_chunk = overlap_text + " " + segment
                    else:
                        current_chunk = segment
            else:
                if current_chunk:
                    current_chunk += " " + segment
                else:
                    current_chunk = segment
        
        # Add final chunk
        if current_chunk:
            chunks.append({
                "id": f"Chunk-{chunk_id}",
                "content": current_chunk.strip(),
                "characters": len(current_chunk.strip())
            })
        
        print(f"Generated {len(chunks)} chunks")
        for chunk in chunks:
            print(f"  {chunk['id']}: {chunk['characters']} characters")
        
        return chunks
    
    def _apply_qa_format(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Apply Q&A format to chunks if enabled"""
        if not self.settings.get('qa_format', False):
            return chunks
            
        question_flag = self.settings.get('question_flag', 'Q: ').strip()
        answer_flag = self.settings.get('answer_flag', 'A: ').strip()
        
        # Create regex patterns for both Chinese and English punctuation
        def create_flag_pattern(flag):
            # Replace punctuation with both Chinese and English versions
            pattern = flag
            # Common punctuation mappings
            punct_map = {
                ':': '[:：]',  # English and Chinese colon
                '?': '[?？]',  # English and Chinese question mark
                '!': '[!！]',  # English and Chinese exclamation
                '.': '[.。]',  # English and Chinese period
                ',': '[,，]',  # English and Chinese comma
                ';': '[;；]',  # English and Chinese semicolon
            }
            
            for eng, pattern_repl in punct_map.items():
                if eng in pattern:
                    pattern = pattern.replace(eng, pattern_repl)
            
            return pattern
        
        question_pattern = create_flag_pattern(question_flag)
        answer_pattern = create_flag_pattern(answer_flag)
        
        qa_chunks = []
        for chunk in chunks:
            content = chunk['content']
            
            # Find all question positions using regex
            import re
            question_matches = list(re.finditer(question_pattern, content))
            
            if not question_matches:
                # No Q&A format found, keep original
                qa_chunks.append(chunk)
                continue
            
            # Process each Q&A block (from one question to the next)
            for i, match in enumerate(question_matches):
                question_start = match.start()
                question_text = match.group()
                
                # Find the end of this Q&A block
                if i + 1 < len(question_matches):
                    # Next question starts here
                    next_question_start = question_matches[i + 1].start()
                    qa_block = content[question_start:next_question_start]
                else:
                    # This is the last question, go to end of content
                    qa_block = content[question_start:]
                
                # Find answer flag in this block
                answer_match = re.search(answer_pattern, qa_block)
                if answer_match:
                    answer_start = answer_match.start()
                    question_part = qa_block[:answer_start].strip()
                    answer_part = qa_block[answer_start + len(answer_match.group()):].strip()
                    
                    # Remove the question flag from question part
                    question = question_part.replace(question_text, '', 1).strip()
                    # Remove the answer flag from answer part  
                    answer = answer_part.replace(answer_match.group(), '', 1).strip()
                    
                    if question and answer:
                        qa_chunks.append({
                            'id': f"qa_{len(qa_chunks) + 1}",
                            'content': f"Question: {question}\nAnswer: {answer}",
                            'characters': len(question) + len(answer) + 20  # +20 for "Question: " and "Answer: "
                        })
        
        return qa_chunks if qa_chunks else chunks
