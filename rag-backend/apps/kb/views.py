"""
API views for document processing and chunking
"""
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .service.chunking_service import ChunkingService
from .service.document_parser import DocumentParser
from .models import ChunkSettings, KnowledgeBase, Document, Chunk
from apps.llm.models import ModelCredential
import os
import tempfile
import uuid
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.utils import timezone


@api_view(['POST'])
def upload_file(request):
    """Upload and store a file"""
    try:
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        uploaded_file = request.FILES['file']
        
        # Save file to temporary location
        file_path = default_storage.save(f'temp/{uploaded_file.name}', ContentFile(uploaded_file.read()))
        full_path = default_storage.path(file_path)
        
        return Response({
            'file_path': full_path,
            'file_name': uploaded_file.name,
            'file_size': uploaded_file.size
        })
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def preview_chunks(request):
    """Preview document chunks based on settings"""
    try:
        file_path = request.data.get('file_path', '')
        settings = request.data.get('settings', {})
        
        # Handle literal newline characters in delimiter
        if 'delimiter' in settings:
            settings['delimiter'] = settings['delimiter'].replace('\\n', '\n')
        
        print(f"File path: {file_path}")
        print(f"Settings received: {settings}")
        
        if not file_path:
            return Response({'error': 'File path is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Parse the actual document
        parser = DocumentParser()
        document_content = parser.parse_document(file_path)
        
        # Initialize chunking service
        chunking_service = ChunkingService(settings)
        
        # Process document
        chunks = chunking_service.process_document(document_content)
        
        return Response({
            'chunks': chunks,
            'total_chunks': len(chunks)
        })
    
    except Exception as e:
        import traceback
        print(f"Error in preview_chunks: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def update_chunk(request):
    """Update a specific chunk"""
    try:
        chunk_id = request.data.get('chunk_id')
        content = request.data.get('content', '')
        
        if not chunk_id:
            return Response({'error': 'Chunk ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # In a real implementation, this would update the chunk in memory or database
        return Response({
            'chunk_id': chunk_id,
            'content': content,
            'characters': len(content)
        })
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
def delete_chunk(request, chunk_id):
    """Delete a specific chunk"""
    try:
        # In a real implementation, this would remove the chunk from memory or database
        return Response({'message': f'Chunk {chunk_id} deleted successfully'})
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def add_chunk(request):
    """Add a new chunk"""
    try:
        content = request.data.get('content', '')
        
        if not content:
            return Response({'error': 'Content is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # In a real implementation, this would add the chunk to memory or database
        new_chunk = {
            'id': f'Chunk-{request.data.get("chunk_number", 1)}',
            'content': content,
            'characters': len(content)
        }
        
        return Response(new_chunk, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def create_knowledge_base(request):
    """Create a new knowledge base with documents and chunks"""
    try:
        data = request.data
        
        # Extract knowledge base information
        kb_name = data.get('name', '')
        files = data.get('files', [])
        settings = data.get('settings', {})
        embedding_model_id = data.get('embedding_model_id')
        preview_chunks = data.get('preview_chunks')  # Get preview chunks if they exist
        
        if not kb_name:
            return Response({'error': 'Knowledge base name is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not files:
            return Response({'error': 'At least one file is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get embedding model
        embedding_model = None
        if embedding_model_id:
            try:
                embedding_model = ModelCredential.objects.get(id=embedding_model_id)
            except ModelCredential.DoesNotExist:
                return Response({'error': 'Embedding model not found'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Determine chunk type based on settings
        chunk_type = 'qa' if settings.get('qa_format', False) else 'general'
        print(f"Creating knowledge base with chunk_type: {chunk_type}")
        
        # Create chunk settings for this knowledge base
        chunk_settings = ChunkSettings.objects.create(
            chunk_type=chunk_type,
            delimiter=settings.get('delimiter', '\\n\\n'),
            max_length=settings.get('max_length', 1024),
            overlap=settings.get('overlap', 50),
            replace_spaces=settings.get('replace_spaces', True),
            delete_urls=settings.get('delete_urls', False),
            qa_format=settings.get('qa_format', False),
            qa_language=settings.get('qa_language', 'English'),
            question_flag=settings.get('question_flag', 'Q: '),
            answer_flag=settings.get('answer_flag', 'A: '),
            qa_max_length=settings.get('qa_max_length', 1024)
        )
        print(f"Created chunk_settings with ID: {chunk_settings.id}")
        
        # Create knowledge base
        kb = KnowledgeBase.objects.create(
            name=kb_name,
            chunk_settings=chunk_settings,
            index_method=settings.get('index_method', 'hq'),
            retrieval_mode=settings.get('retrieval_mode', 'vector'),
            embedding_model=embedding_model
        )
        print(f"Created knowledge base with ID: {kb.id}")
        
        # Process each file
        created_documents = []
        for file_path in files:
            # Extract filename from path
            file_name = file_path.split('/')[-1] if '/' in file_path else file_path.split('\\')[-1]
            file_type = file_name.split('.')[-1] if '.' in file_name else 'unknown'
            
            # Get file size
            try:
                file_size = os.path.getsize(file_path)
            except:
                file_size = 0
            
            # Create document record
            document = Document.objects.create(
                knowledge_base=kb,
                file_name=file_name,
                file_path=file_path,
                file_size=file_size,
                file_type=file_type,
                status='processing'
            )
            print(f"Created document with ID: {document.id} for file: {file_name}")
            
            # Process document and create chunks
            try:
                # Check if we have preview chunks to use
                if preview_chunks and len(preview_chunks) > 0:
                    print(f"Using preview chunks for document: {file_name}")
                    chunks = preview_chunks
                else:
                    # Parse document and generate chunks normally
                    parser = DocumentParser()
                    document_content = parser.parse_document(file_path)
                    
                    # Initialize chunking service
                    chunking_service = ChunkingService(settings)
                    chunks = chunking_service.process_document(document_content)
                
                # Create chunk records
                for i, chunk_data in enumerate(chunks):
                    Chunk.objects.create(
                        document=document,
                        chunk_id=chunk_data.get('id', f'chunk_{i+1}'),
                        content=chunk_data.get('content', ''),
                        characters=chunk_data.get('characters', 0),
                        chunk_number=i + 1
                    )
                
                # Update document status
                document.status = 'completed'
                document.processed_at = timezone.now()
                document.save()
                
                created_documents.append({
                    'id': document.id,
                    'file_name': document.file_name,
                    'status': document.status,
                    'chunks_count': len(chunks)
                })
                
            except Exception as e:
                # Mark document as failed
                import traceback
                error_details = traceback.format_exc()
                print(f"Error processing document {file_name}: {str(e)}")
                print(f"Traceback: {error_details}")
                
                document.status = 'failed'
                document.save()
                created_documents.append({
                    'id': document.id,
                    'file_name': document.file_name,
                    'status': 'failed',
                    'error': str(e)
                })
        
        return Response({
            'knowledge_base_id': kb.id,
            'knowledge_base_name': kb.name,
            'documents': created_documents,
            'total_documents': len(created_documents),
            'created_at': kb.created_at
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        import traceback
        print(f"Error in create_knowledge_base: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def check_knowledge_base_name(request):
    """Check if a knowledge base name already exists"""
    try:
        name = request.data.get('name', '')
        if not name:
            return Response({'error': 'Name is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if knowledge base with this name already exists
        exists = KnowledgeBase.objects.filter(name=name).exists()
        
        return Response({
            'name': name,
            'exists': exists
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_chunk_settings(request, kb_id):
    """Get chunk settings for a knowledge base"""
    try:
        # Get the knowledge base
        kb = KnowledgeBase.objects.get(id=kb_id)
        chunk_settings = kb.chunk_settings
        
        # Return chunk settings data
        return Response({
            'chunk_type': chunk_settings.chunk_type,
            'delimiter': chunk_settings.delimiter,
            'max_length': chunk_settings.max_length,
            'overlap': chunk_settings.overlap,
            'replace_spaces': chunk_settings.replace_spaces,
            'delete_urls': chunk_settings.delete_urls,
            'qa_format': chunk_settings.qa_format,
            'qa_language': chunk_settings.qa_language,
            'question_flag': chunk_settings.question_flag,
            'answer_flag': chunk_settings.answer_flag,
            'qa_max_length': chunk_settings.qa_max_length,
            'index_method': kb.index_method,
            'retrieval_mode': kb.retrieval_mode,
        })
        
    except KnowledgeBase.DoesNotExist:
        return Response({'error': 'Knowledge base not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)