from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        # Create user_schema
        migrations.RunSQL(
            "CREATE SCHEMA IF NOT EXISTS user_schema;",
            reverse_sql="DROP SCHEMA IF EXISTS user_schema CASCADE;"
        ),

        # Create UserProfile model
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('user_id', models.UUIDField(db_index=True, unique=True)),
                ('phone', models.CharField(blank=True, max_length=20)),
                ('address', models.JSONField(blank=True, null=True)),
                ('preferences', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'user_profiles',
            },
        ),

        # Create Pet model
        migrations.CreateModel(
            name='Pet',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('user_id', models.UUIDField(db_index=True)),
                ('name', models.CharField(max_length=100)),
                ('breed', models.CharField(blank=True, max_length=100)),
                ('breed_confidence', models.FloatField(blank=True, null=True)),
                ('species', models.CharField(choices=[('dog', 'Dog'), ('cat', 'Cat'), ('other', 'Other')], max_length=20)),
                ('age', models.IntegerField(blank=True, null=True)),
                ('weight', models.FloatField(blank=True, null=True)),
                ('health_conditions', models.JSONField(blank=True, default=list)),
                ('image_url', models.CharField(blank=True, max_length=500, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'pets',
            },
        ),

        # Create PetAnalysis model
        migrations.CreateModel(
            name='PetAnalysis',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True)),
                ('pet_id', models.UUIDField(db_index=True)),
                ('user_id', models.UUIDField(db_index=True)),
                ('image_url', models.CharField(max_length=500)),
                ('breed_detected', models.CharField(max_length=100)),
                ('confidence', models.FloatField()),
                ('traits', models.JSONField(default=dict)),
                ('raw_response', models.JSONField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'pet_analyses',
                'ordering': ['-created_at'],
            },
        ),

        # Add indexes
        migrations.AddIndex(
            model_name='userprofile',
            index=models.Index(fields=['user_id'], name='userprofile_user_id_idx'),
        ),
        migrations.AddIndex(
            model_name='userprofile',
            index=models.Index(fields=['created_at'], name='userprofile_created_idx'),
        ),
        migrations.AddIndex(
            model_name='pet',
            index=models.Index(fields=['user_id', 'created_at'], name='pet_user_created_idx'),
        ),
        migrations.AddIndex(
            model_name='pet',
            index=models.Index(fields=['species'], name='pet_species_idx'),
        ),
        migrations.AddIndex(
            model_name='petanalysis',
            index=models.Index(fields=['pet_id', 'created_at'], name='petanalysis_pet_created_idx'),
        ),
        migrations.AddIndex(
            model_name='petanalysis',
            index=models.Index(fields=['user_id', 'created_at'], name='petanalysis_user_created_idx'),
        ),
    ]
