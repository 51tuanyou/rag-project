# Generated manually for Tag models

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('kb', '0005_remove_document_chunk_count_and_more'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='Tag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text='Tag name', max_length=100, unique=True)),
                ('description', models.TextField(blank=True, help_text='Tag description', null=True)),
                ('color', models.CharField(default='#1976d2', help_text='Tag color in hex format', max_length=7)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='auth.user')),
            ],
            options={
                'verbose_name': 'Tag',
                'verbose_name_plural': 'Tags',
                'db_table': 'kb_tag',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='KnowledgeBaseTag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('knowledge_base', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='kb_tags', to='kb.knowledgebase')),
                ('tag', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='kb_tags', to='kb.tag')),
            ],
            options={
                'verbose_name': 'Knowledge Base Tag',
                'verbose_name_plural': 'Knowledge Base Tags',
                'db_table': 'kb_knowledge_base_tag',
                'unique_together': {('knowledge_base', 'tag')},
            },
        ),
    ]
