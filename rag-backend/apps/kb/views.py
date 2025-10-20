"""
API views for document processing and chunking
"""
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .service.chunking_service import ChunkingService
from .service.document_parser import DocumentParser
import os
import tempfile
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile


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