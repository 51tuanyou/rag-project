# Generated manually for retrieval test models

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('kb', '0009_auto_20251021_1321'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='RetrievalTestRecord',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('query_text', models.TextField(help_text='User input query text')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='auth.user')),
                ('knowledge_base', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='retrieval_tests', to='kb.knowledgebase')),
            ],
            options={
                'verbose_name': 'Retrieval Test Record',
                'verbose_name_plural': 'Retrieval Test Records',
                'db_table': 'kb_retrieval_test_record',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='RetrievalTestResult',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('similarity_score', models.FloatField(help_text='Similarity score between query and chunk')),
                ('rank', models.IntegerField(help_text='Rank of this result (1-based)')),
                ('chunk', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='retrieval_results', to='kb.chunk')),
                ('test_record', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='results', to='kb.retrievaltestrecord')),
            ],
            options={
                'verbose_name': 'Retrieval Test Result',
                'verbose_name_plural': 'Retrieval Test Results',
                'db_table': 'kb_retrieval_test_result',
                'ordering': ['rank'],
            },
        ),
    ]
