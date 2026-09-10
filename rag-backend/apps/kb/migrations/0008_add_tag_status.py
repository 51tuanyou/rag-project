# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('kb', '0007_tag_knowledge_base_alter_tag_name_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='tag',
            name='status',
            field=models.CharField(choices=[('active', 'Active'), ('inactive', 'Inactive')], default='active', help_text='Tag status: active or inactive', max_length=10),
        ),
    ]
