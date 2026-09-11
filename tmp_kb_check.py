import django, os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
from apps.kb.models import KnowledgeBase, Document, Chunk
print("KB count:", KnowledgeBase.objects.count())
for kb in KnowledgeBase.objects.all():
    emb = kb.embedding_model.model_name if kb.embedding_model else None
    docs = list(Document.objects.filter(knowledge_base=kb))
    nchunks = Chunk.objects.filter(document__knowledge_base=kb).count()
    print(f"KB {kb.id}: name={kb.name!r} emb={emb!r} docs={len(docs)} chunks={nchunks}")
    for d in docs:
        print(f"  doc {d.id}: {d.file_name}")
