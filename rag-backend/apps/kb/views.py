"""
API views for document processing and chunking
"""
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .service.chunking_service import ChunkingService
from .service.document_parser import DocumentParser
from .models import ChunkSettings, KnowledgeBase, Document, Chunk, Tag
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


@api_view(['GET'])
def get_documents(request):
    """Get documents for a specific knowledge base"""
    try:
        kb_id = request.GET.get('kb_id')
        if not kb_id:
            return Response({'error': 'Knowledge base ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get documents for specific knowledge base
        documents = Document.objects.filter(knowledge_base_id=kb_id).select_related('knowledge_base', 'knowledge_base__chunk_settings')
        
        document_list = []
        for doc in documents:
            # Calculate word count from chunks
            word_count = sum(chunk.word_count for chunk in doc.chunks.all())
            chunk_count = doc.chunks.count()
            
            # Get chunking mode from database
            chunking_mode = 'GENERAL'
            if doc.knowledge_base.chunk_settings:
                if doc.knowledge_base.chunk_settings.chunk_type == 'qa':
                    chunking_mode = 'Q&A'
                elif doc.knowledge_base.chunk_settings.delimiter != '\\n\\n':
                    chunking_mode = 'CUSTOM'
            
            document_list.append({
                'id': doc.id,
                'file_name': doc.file_name,
                'file_path': doc.file_path,
                'file_type': doc.file_type,
                'file_size': doc.file_size,
                'chunking_mode': chunking_mode,
                'word_count': f"{word_count:,}",
                'chunk_count': chunk_count,
                'retrieval_count': 0,  # TODO: Implement retrieval count tracking
                'upload_time': doc.uploaded_at.strftime('%Y/%m/%d %H:%M:%S'),
                'status': doc.status,
                'knowledge_base_id': doc.knowledge_base.id,
                'knowledge_base_name': doc.knowledge_base.name
            })
        
        return Response({
            'documents': document_list,
            'total': len(document_list),
            'knowledge_base_id': int(kb_id)
        })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH'])
def update_document_status(request, doc_id):
    """Update document status (enable/disable)"""
    try:
        data = request.data
        new_status = data.get('status')
        
        if new_status not in ['completed', 'disabled']:
            return Response({'error': 'Invalid status. Must be "completed" or "disabled"'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            document = Document.objects.get(id=doc_id)
        except Document.DoesNotExist:
            return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)
        
        document.status = new_status
        document.save()
        
        return Response({
            'id': document.id,
            'file_name': document.file_name,
            'status': document.status,
            'message': f'Document status updated to {new_status}'
        })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_knowledge_bases(request):
    """Get all knowledge bases"""
    try:
        # Get all knowledge bases with related data
        knowledge_bases = KnowledgeBase.objects.select_related('chunk_settings', 'embedding_model').prefetch_related('documents')
        
        kb_list = []
        for kb in knowledge_bases:
            # Count documents for this knowledge base
            document_count = kb.documents.count()
            
            # Count available documents (status = 'completed')
            available_document_count = kb.documents.filter(status='completed').count()
            
            # Get chunking mode from database
            chunking_mode = 'GENERAL'
            if kb.chunk_settings:
                if kb.chunk_settings.chunk_type == 'qa':
                    chunking_mode = 'Q&A'
                elif kb.chunk_settings.delimiter != '\\n\\n':
                    chunking_mode = 'CUSTOM'
            
            # Get retrieval mode display
            retrieval_mode_display = kb.retrieval_mode.upper()
            if kb.retrieval_mode == 'vector':
                retrieval_mode_display = 'VECTOR'
            elif kb.retrieval_mode == 'fulltext':
                retrieval_mode_display = 'FULL-TEXT'
            elif kb.retrieval_mode == 'hybrid':
                retrieval_mode_display = 'HYBRID'
            
            # Get index method display
            index_method_display = kb.index_method.upper()
            if kb.index_method == 'hq':
                index_method_display = 'HQ'
            elif kb.index_method == 'eco':
                index_method_display = 'ECO'
            
            kb_list.append({
                'id': kb.id,
                'name': kb.name,
                'description': kb.description or '',
                'document_count': document_count,
                'available_document_count': available_document_count,
                'chunking_mode': chunking_mode,
                'retrieval_mode': retrieval_mode_display,
                'index_method': index_method_display,
                'embedding_model': kb.embedding_model.model_name if kb.embedding_model else None,
                'created_at': kb.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'updated_at': kb.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
                'created_by': kb.created_by.username if kb.created_by else None
            })
        
        return Response({
            'knowledge_bases': kb_list,
            'total': len(kb_list)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PUT'])
def update_knowledge_base(request, kb_id):
    """Update a knowledge base"""
    try:
        data = request.data
        
        # Get the knowledge base
        try:
            kb = KnowledgeBase.objects.get(id=kb_id)
        except KnowledgeBase.DoesNotExist:
            return Response({'error': 'Knowledge base not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Update fields
        if 'name' in data:
            kb.name = data['name']
        
        if 'description' in data:
            kb.description = data['description']
        
        # Save the changes
        kb.save()
        
        return Response({
            'id': kb.id,
            'name': kb.name,
            'description': kb.description,
            'updated_at': kb.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
            'message': 'Knowledge base updated successfully'
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Tag-related API endpoints

@api_view(['GET'])
def get_tags(request):
    """Get all tags with optional search"""
    try:
        search_query = request.GET.get('search', '')
        
        if search_query:
            tags = Tag.objects.filter(name__icontains=search_query)
        else:
            tags = Tag.objects.all()
        
        tag_list = []
        for tag in tags:
            # Count how many knowledge bases use this tag (now just 1 since tag belongs to one KB)
            kb_count = 1
            
            tag_list.append({
                'id': tag.id,
                'name': tag.name,
                'description': tag.description or '',
                'color': tag.color,
                'status': tag.status,
                'knowledge_base': tag.knowledge_base.id if tag.knowledge_base else None,
                'kb_count': kb_count,
                'created_at': tag.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'created_by': tag.created_by.username if tag.created_by else None
            })
        
        return Response({
            'tags': tag_list,
            'total': len(tag_list)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def create_tag(request):
    """Create a new tag"""
    try:
        data = request.data
        
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        color = data.get('color', '#1976d2')
        knowledge_base_id = data.get('knowledge_base_id')
        
        if not name:
            return Response({'error': 'Tag name is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not knowledge_base_id:
            return Response({'error': 'Knowledge base ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get the knowledge base
        try:
            knowledge_base = KnowledgeBase.objects.get(id=knowledge_base_id)
        except KnowledgeBase.DoesNotExist:
            return Response({'error': 'Knowledge base not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if tag already exists in this knowledge base
        if Tag.objects.filter(name=name, knowledge_base=knowledge_base).exists():
            return Response({'error': 'Tag with this name already exists in this knowledge base'}, status=status.HTTP_400_BAD_REQUEST)
        
        tag = Tag.objects.create(
            name=name,
            description=description,
            color=color,
            knowledge_base=knowledge_base
        )
        
        return Response({
            'id': tag.id,
            'name': tag.name,
            'description': tag.description,
            'color': tag.color,
            'created_at': tag.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'message': 'Tag created successfully'
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PUT'])
def update_tag(request, tag_id):
    """Update a tag"""
    try:
        data = request.data
        
        try:
            tag = Tag.objects.get(id=tag_id)
        except Tag.DoesNotExist:
            return Response({'error': 'Tag not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Update fields
        if 'name' in data:
            new_name = data['name'].strip()
            if new_name and new_name != tag.name:
                # Check if new name already exists
                if Tag.objects.filter(name=new_name).exclude(id=tag_id).exists():
                    return Response({'error': 'Tag with this name already exists'}, status=status.HTTP_400_BAD_REQUEST)
                tag.name = new_name
        
        if 'description' in data:
            tag.description = data['description'].strip()
        
        if 'color' in data:
            tag.color = data['color']
        
        tag.save()
        
        return Response({
            'id': tag.id,
            'name': tag.name,
            'description': tag.description,
            'color': tag.color,
            'updated_at': tag.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
            'message': 'Tag updated successfully'
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
def delete_tag(request, tag_id):
    """Delete a tag"""
    try:
        try:
            tag = Tag.objects.get(id=tag_id)
        except Tag.DoesNotExist:
            return Response({'error': 'Tag not found'}, status=status.HTTP_404_NOT_FOUND)
        
        tag_name = tag.name
        tag.delete()
        
        return Response({
            'message': f'Tag "{tag_name}" deleted successfully'
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_kb_tags(request, kb_id):
    """Get tags for a specific knowledge base"""
    try:
        try:
            kb = KnowledgeBase.objects.get(id=kb_id)
        except KnowledgeBase.DoesNotExist:
            return Response({'error': 'Knowledge base not found'}, status=status.HTTP_404_NOT_FOUND)
        
        kb_tags = Tag.objects.filter(knowledge_base=kb, status='active')
        
        tag_list = []
        for tag in kb_tags:
            tag_list.append({
                'id': tag.id,
                'name': tag.name,
                'description': tag.description or '',
                'color': tag.color,
                'created_at': tag.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        return Response({
            'knowledge_base_id': kb_id,
            'knowledge_base_name': kb.name,
            'tags': tag_list,
            'total': len(tag_list)
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def add_tag_to_kb(request, kb_id):
    """Add a tag to a knowledge base"""
    try:
        data = request.data
        tag_id = data.get('tag_id')
        
        if not tag_id:
            return Response({'error': 'Tag ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            kb = KnowledgeBase.objects.get(id=kb_id)
        except KnowledgeBase.DoesNotExist:
            return Response({'error': 'Knowledge base not found'}, status=status.HTTP_404_NOT_FOUND)
        
        try:
            tag = Tag.objects.get(id=tag_id)
        except Tag.DoesNotExist:
            return Response({'error': 'Tag not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if tag belongs to this knowledge base
        if tag.knowledge_base != kb:
            return Response({'error': 'Tag does not belong to this knowledge base'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if tag is already active
        if tag.status == 'active':
            return Response({'error': 'Tag is already active'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Activate the tag
        tag.status = 'active'
        tag.save()
        
        return Response({
            'knowledge_base_id': kb_id,
            'tag_id': tag_id,
            'tag_name': tag.name,
            'created_at': tag.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
            'message': f'Tag "{tag.name}" activated successfully'
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
def remove_tag_from_kb(request, kb_id, tag_id):
    """Remove a tag from a knowledge base"""
    try:
        try:
            kb = KnowledgeBase.objects.get(id=kb_id)
        except KnowledgeBase.DoesNotExist:
            return Response({'error': 'Knowledge base not found'}, status=status.HTTP_404_NOT_FOUND)
        
        try:
            tag = Tag.objects.get(id=tag_id)
        except Tag.DoesNotExist:
            return Response({'error': 'Tag not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if tag belongs to this knowledge base
        if tag.knowledge_base != kb:
            return Response({'error': 'Tag does not belong to this knowledge base'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if tag is already inactive
        if tag.status == 'inactive':
            return Response({'error': 'Tag is already inactive'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Deactivate the tag
        tag_name = tag.name
        tag.status = 'inactive'
        tag.save()
        
        return Response({
            'message': f'Tag "{tag_name}" removed from knowledge base successfully'
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_chunks(request):
    """Get chunks for a specific document"""
    try:
        document_id = request.GET.get('document_id')
        if not document_id:
            return Response({'error': 'Document ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get chunks for the document
        chunks = Chunk.objects.filter(document_id=document_id).order_by('chunk_number')
        
        chunk_list = []
        for chunk in chunks:
            chunk_list.append({
                'id': chunk.chunk_id,
                'content': chunk.content,
                'characters': chunk.characters,
                'word_count': chunk.word_count,
                'chunk_number': chunk.chunk_number,
                'created_at': chunk.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        return Response({
            'chunks': chunk_list,
            'total': len(chunk_list)
        })
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
def clear_document_chunks(request, document_id):
    """Clear all chunks for a specific document"""
    try:
        # Get the document
        try:
            document = Document.objects.get(id=document_id)
        except Document.DoesNotExist:
            return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Delete all chunks for this document
        chunks_deleted = Chunk.objects.filter(document=document).delete()
        
        print(f"Deleted {chunks_deleted[0]} chunks for document {document_id}")
        
        return Response({
            'message': f'Successfully cleared {chunks_deleted[0]} chunks for document {document_id}',
            'chunks_deleted': chunks_deleted[0]
        })
        
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def process_document(request):
    """Process a document with new chunk settings"""
    try:
        data = request.data
        document_id = data.get('document_id')
        file_path = data.get('file_path')
        settings = data.get('settings', {})
        
        if not document_id:
            return Response({'error': 'Document ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not file_path:
            return Response({'error': 'File path is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get the document
        try:
            document = Document.objects.get(id=document_id)
        except Document.DoesNotExist:
            return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Handle literal newline characters in delimiter
        if 'delimiter' in settings:
            settings['delimiter'] = settings['delimiter'].replace('\\n', '\n')
        
        print(f"Processing document {document_id} with file path: {file_path}")
        print(f"Settings: {settings}")
        
        # Parse the document
        parser = DocumentParser()
        document_content = parser.parse_document(file_path)
        
        # Initialize chunking service
        chunking_service = ChunkingService(settings)
        chunks = chunking_service.process_document(document_content)
        
        # Create new chunk records
        for i, chunk_data in enumerate(chunks):
            Chunk.objects.create(
                document=document,
                chunk_id=chunk_data.get('id', f'chunk_{i+1}'),
                content=chunk_data.get('content', ''),
                characters=chunk_data.get('characters', 0),
                chunk_number=i + 1
            )
        
        print(f"Created {len(chunks)} new chunks for document {document_id}")
        
        return Response({
            'message': f'Successfully processed document {document_id}',
            'chunks_created': len(chunks)
        })
        
    except Exception as e:
        import traceback
        print(f"Error in process_document: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def save_document_chunks(request):
    """Save chunks for a document (clear existing and save new ones)"""
    try:
        data = request.data
        document_id = data.get('document_id')
        chunks = data.get('chunks', [])
        
        if not document_id:
            return Response({'error': 'Document ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get the document
        try:
            document = Document.objects.get(id=document_id)
        except Document.DoesNotExist:
            return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Clear existing chunks for this document
        chunks_deleted = Chunk.objects.filter(document=document).delete()
        print(f"Deleted {chunks_deleted[0]} existing chunks for document {document_id}")
        
        # Create new chunk records
        for chunk_data in chunks:
            Chunk.objects.create(
                document=document,
                chunk_id=chunk_data.get('chunk_id', f'chunk_{chunk_data.get("chunk_number", 1)}'),
                content=chunk_data.get('content', ''),
                characters=chunk_data.get('characters', 0),
                chunk_number=chunk_data.get('chunk_number', 1)
            )
        
        print(f"Created {len(chunks)} new chunks for document {document_id}")
        
        return Response({
            'message': f'Successfully saved {len(chunks)} chunks for document {document_id}',
            'chunks_saved': len(chunks)
        })
        
    except Exception as e:
        import traceback
        print(f"Error in save_document_chunks: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)