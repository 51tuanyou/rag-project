"""
Prompts for document chunking operations
"""

CHUNK_PREVIEW_PROMPT = """
You are a document processing assistant. Your task is to split the given document into meaningful chunks based on the specified settings.

Settings:
- Delimiter: {delimiter}
- Maximum chunk length: {max_length} characters
- Chunk overlap: {overlap} characters
- Replace spaces/newlines/tabs: {replace_spaces}
- Delete URLs/emails: {delete_urls}
- Q&A format: {qa_format}
- Language: {qa_language}

Please process the following document and return the chunks in JSON format:
{{
  "chunks": [
    {{
      "id": "Chunk-1",
      "content": "chunk content here",
      "characters": 123
    }}
  ]
}}

Document to process:
{document}
"""

QA_FORMAT_PROMPT = """
Convert the following text into Q&A format in {language}:

Text:
{text}

Return in JSON format:
{{
  "qa_pairs": [
    {{
      "question": "Question here",
      "answer": "Answer here"
    }}
  ]
}}
"""
