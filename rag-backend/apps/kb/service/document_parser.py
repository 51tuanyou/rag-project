"""
Document parsing service for handling various file formats
"""
import os
import tempfile
from typing import List, Dict, Any
import docx
import PyPDF2
import pandas as pd


class DocumentParser:
    def __init__(self):
        self.supported_formats = ['.docx', '.pdf', '.txt', '.csv']
    
    def parse_document(self, file_path: str) -> str:
        """Parse document and extract text content"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        file_ext = os.path.splitext(file_path)[1].lower()
        
        if file_ext == '.docx':
            return self._parse_docx(file_path)
        elif file_ext == '.pdf':
            return self._parse_pdf(file_path)
        elif file_ext == '.txt':
            return self._parse_txt(file_path)
        elif file_ext == '.csv':
            return self._parse_csv(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_ext}")
    
    def _parse_docx(self, file_path: str) -> str:
        """Parse DOCX file"""
        try:
            doc = docx.Document(file_path)
            text_content = []
            
            for paragraph in doc.paragraphs:
                if paragraph.text.strip():
                    text_content.append(paragraph.text.strip())
            
            return '\n\n'.join(text_content)
        except Exception as e:
            raise Exception(f"Error parsing DOCX file: {str(e)}")
    
    def _parse_pdf(self, file_path: str) -> str:
        """Parse PDF file"""
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text_content = []
                
                for page in pdf_reader.pages:
                    page_text = page.extract_text()
                    if page_text.strip():
                        text_content.append(page_text.strip())
                
                return '\n\n'.join(text_content)
        except Exception as e:
            raise Exception(f"Error parsing PDF file: {str(e)}")
    
    def _parse_txt(self, file_path: str) -> str:
        """Parse TXT file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read()
        except Exception as e:
            raise Exception(f"Error parsing TXT file: {str(e)}")
    
    def _parse_csv(self, file_path: str) -> str:
        """Parse CSV file"""
        try:
            df = pd.read_csv(file_path)
            # Convert DataFrame to text format
            text_content = []
            for index, row in df.iterrows():
                row_text = ' | '.join([str(value) for value in row.values if pd.notna(value)])
                text_content.append(row_text)
            
            return '\n'.join(text_content)
        except Exception as e:
            raise Exception(f"Error parsing CSV file: {str(e)}")
