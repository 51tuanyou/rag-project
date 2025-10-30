# RAG 后端架构图

## 系统架构概览

```mermaid
graph TB
    subgraph "前端层"
        FE[React Frontend<br/>TypeScript + Vite]
    end
    
    subgraph "API网关层"
        API[Django REST API<br/>CORS + Authentication]
    end
    
    subgraph "应用服务层"
        subgraph "LLM模块"
            LLM[LLM Service<br/>OpenAI/Ollama API]
            LLM_MODEL[Model Management<br/>Provider/ModelCredential]
        end
        
        subgraph "知识库模块"
            KB[Knowledge Base<br/>Document Management]
            CHUNK[Chunking Service<br/>Document Parser]
            TAG[Tag Management<br/>Categorization]
        end
        
        subgraph "智能代理模块"
            RETRIEVAL[Retrieval Service<br/>Vector Search]
            VECTOR[Vectorization Service<br/>Embedding Generation]
        end
    end
    
    subgraph "数据存储层"
        SQLITE[(SQLite Database<br/>Django ORM)]
        PGVECTOR[(PostgreSQL + PGVector<br/>Vector Storage)]
        FILES[File Storage<br/>Document Files]
    end
    
    subgraph "外部服务"
        OPENAI[OpenAI API<br/>Embeddings/LLM]
        OLLAMA[Ollama Local<br/>Local LLM Models]
    end
    
    %% 连接关系
    FE --> API
    API --> LLM
    API --> KB
    API --> RETRIEVAL
    
    LLM --> LLM_MODEL
    LLM --> OPENAI
    LLM --> OLLAMA
    
    KB --> CHUNK
    KB --> TAG
    KB --> FILES
    
    RETRIEVAL --> VECTOR
    VECTOR --> LLM
    VECTOR --> PGVECTOR
    
    CHUNK --> SQLITE
    KB --> SQLITE
    LLM_MODEL --> SQLITE
    TAG --> SQLITE
    
    %% 数据流
    CHUNK -.-> VECTOR
    VECTOR -.-> RETRIEVAL
```

## 详细模块架构

```mermaid
graph LR
    subgraph "Django项目结构"
        subgraph "rag_backend/"
            SETTINGS[settings.py<br/>配置管理]
            URLS[urls.py<br/>路由配置]
            WSGI[wsgi.py<br/>WSGI入口]
        end
        
        subgraph "apps/llm/"
            LLM_MODELS[models.py<br/>Provider/ModelCredential]
            LLM_VIEWS[views.py<br/>API视图]
            LLM_SERVICE[service/llm_service.py<br/>LLM调用服务]
            LLM_URLS[urls.py<br/>LLM路由]
        end
        
        subgraph "apps/kb/"
            KB_MODELS[models.py<br/>KnowledgeBase/Document/Chunk]
            KB_VIEWS[views.py<br/>知识库API]
            KB_SERVICE[service/<br/>文档处理服务]
            KB_URLS[urls.py<br/>知识库路由]
        end
        
        subgraph "apps/agents/"
            AGENT_MODELS[models.py<br/>代理模型]
            AGENT_VIEWS[views.py<br/>代理API]
            AGENT_SERVICE[services/<br/>检索和向量化服务]
            AGENT_URLS[urls.py<br/>代理路由]
        end
    end
    
    subgraph "核心服务"
        DOC_PARSER[DocumentParser<br/>PDF/DOCX/TXT解析]
        CHUNK_SERVICE[ChunkingService<br/>文档分块]
        VECTOR_SERVICE[VectorizationService<br/>向量化处理]
        RETRIEVAL_SERVICE[RetrievalService<br/>相似性检索]
    end
    
    subgraph "数据层"
        DJANGO_DB[(Django Database<br/>SQLite/PostgreSQL)]
        VECTOR_DB[(PGVector<br/>向量数据库)]
    end
    
    %% 连接关系
    LLM_SERVICE --> DOC_PARSER
    KB_SERVICE --> CHUNK_SERVICE
    AGENT_SERVICE --> VECTOR_SERVICE
    AGENT_SERVICE --> RETRIEVAL_SERVICE
    
    VECTOR_SERVICE --> VECTOR_DB
    RETRIEVAL_SERVICE --> VECTOR_DB
    
    LLM_MODELS --> DJANGO_DB
    KB_MODELS --> DJANGO_DB
    AGENT_MODELS --> DJANGO_DB
```

## 数据流架构

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant A as API层
    participant K as 知识库模块
    participant C as 分块服务
    participant V as 向量化服务
    participant R as 检索服务
    participant L as LLM服务
    participant D as 数据库
    participant P as PGVector
    
    U->>F: 上传文档
    F->>A: POST /api/kb/upload-file/
    A->>K: 处理文档上传
    K->>C: 文档分块处理
    C->>D: 保存分块数据
    K->>V: 向量化分块
    V->>L: 生成嵌入向量
    L-->>V: 返回向量
    V->>P: 存储向量数据
    V-->>K: 向量化完成
    K-->>A: 处理完成
    A-->>F: 返回结果
    F-->>U: 显示处理结果
    
    Note over U,P: 检索查询流程
    
    U->>F: 输入查询
    F->>A: POST /api/agents/search-similar-chunks/
    A->>R: 执行检索
    R->>L: 生成查询向量
    L-->>R: 返回查询向量
    R->>P: 向量相似性搜索
    P-->>R: 返回相似分块
    R-->>A: 返回检索结果
    A-->>F: 返回结果
    F-->>U: 显示检索结果
```

## 技术栈详情

### 后端框架
- **Django 5.2.7** - Web框架
- **Django REST Framework** - API框架
- **Django CORS Headers** - 跨域处理

### 数据库
- **SQLite/PostgreSQL** - 主数据库（Django ORM）
- **PostgreSQL + PGVector** - 向量数据库

### 外部服务
- **OpenAI API** - 嵌入向量生成
- **Ollama** - 本地LLM服务

### 文档处理
- **python-docx** - DOCX文件解析
- **PyPDF2** - PDF文件解析
- **pandas** - CSV文件处理

### 向量处理
- **numpy** - 数值计算
- **psycopg2** - PostgreSQL连接
- **aiohttp** - 异步HTTP请求

## 核心功能模块

### 1. LLM模块 (apps/llm)
- **Provider管理**: 支持多个LLM提供商
- **模型配置**: 管理不同模型的凭据和参数
- **API调用**: 统一的LLM和嵌入向量API调用接口

### 2. 知识库模块 (apps/kb)
- **文档管理**: 上传、存储、管理各种格式文档
- **分块处理**: 智能文档分块，支持Q&A格式
- **标签系统**: 知识库分类和标签管理
- **检索测试**: 检索效果测试和记录

### 3. 智能代理模块 (apps/agents)
- **向量化服务**: 将文档分块转换为向量
- **检索服务**: 基于向量相似性的智能检索
- **相似性搜索**: 使用PGVector进行高效向量搜索

## 部署架构

```mermaid
graph TB
    subgraph "生产环境"
        subgraph "Web服务器"
            NGINX[Nginx<br/>反向代理]
            GUNICORN[Gunicorn<br/>WSGI服务器]
        end
        
        subgraph "应用服务器"
            DJANGO[Django应用<br/>RAG Backend]
        end
        
        subgraph "数据库服务器"
            POSTGRES[(PostgreSQL<br/>主数据库)]
            PGVECTOR_DB[(PostgreSQL + PGVector<br/>向量数据库)]
        end
        
        subgraph "文件存储"
            FILES[文件系统<br/>文档存储]
        end
        
        subgraph "外部服务"
            OPENAI_API[OpenAI API<br/>嵌入向量]
            OLLAMA_SVC[Ollama服务<br/>本地LLM]
        end
    end
    
    NGINX --> GUNICORN
    GUNICORN --> DJANGO
    DJANGO --> POSTGRES
    DJANGO --> PGVECTOR_DB
    DJANGO --> FILES
    DJANGO --> OPENAI_API
    DJANGO --> OLLAMA_SVC
```

## 数据库设计架构

### 核心数据模型

```mermaid
erDiagram
    %% 用户认证模块
    User ||--o{ KnowledgeBase : creates
    User ||--o{ Tag : creates
    User ||--o{ RetrievalTestRecord : creates
    
    %% LLM模块
    Provider ||--o{ ProviderApiKey : has
    Provider ||--o{ ModelCredential : has
    ProviderApiKey {
        int id PK
        string name
        text secret
        string organization
        string api_base
        boolean is_selected
    }
    ModelCredential {
        int id PK
        string model_id
        string model_name
        string model_type
        string base_url
        text secret
        string organization
        int context_size
        int max_tokens
        string completion_mode
        boolean vision_support
        boolean function_call_support
        boolean enabled
    }
    
    %% 知识库模块
    KnowledgeBase ||--o{ Document : contains
    KnowledgeBase ||--o{ Tag : has
    KnowledgeBase ||--o{ RetrievalTestRecord : tests
    KnowledgeBase }o--|| ChunkSettings : uses
    KnowledgeBase }o--|| ModelCredential : embedding_model
    
    Document ||--o{ Chunk : contains
    Chunk ||--o{ RetrievalTestResult : appears_in
    
    RetrievalTestRecord ||--o{ RetrievalTestResult : has
    
    %% 分块设置
    ChunkSettings {
        int id PK
        string chunk_type
        string delimiter
        int max_length
        int overlap
        boolean replace_spaces
        boolean delete_urls
        boolean qa_format
        string qa_language
        string question_flag
        string answer_flag
        int qa_max_length
        datetime created_at
        datetime updated_at
    }
    
    %% 知识库
    KnowledgeBase {
        int id PK
        string name
        text description
        string index_method
        string retrieval_mode
        datetime created_at
        datetime updated_at
        int created_by_id FK
        int chunk_settings_id FK
        int embedding_model_id FK
    }
    
    %% 文档
    Document {
        int id PK
        string file_name
        string file_path
        bigint file_size
        string file_type
        string status
        datetime uploaded_at
        datetime processed_at
        int knowledge_base_id FK
    }
    
    %% 文档分块
    Chunk {
        int id PK
        string chunk_id
        text content
        int characters
        int word_count
        int chunk_number
        datetime created_at
        int document_id FK
    }
    
    %% 标签
    Tag {
        int id PK
        string name
        text description
        string color
        string status
        datetime created_at
        datetime updated_at
        int knowledge_base_id FK
        int created_by_id FK
    }
    
    %% 检索测试
    RetrievalTestRecord {
        int id PK
        text query_text
        datetime created_at
        int knowledge_base_id FK
        int created_by_id FK
    }
    
    RetrievalTestResult {
        int id PK
        float similarity_score
        int rank
        int test_record_id FK
        int chunk_id FK
    }
```

### 数据库表结构详情

#### 1. LLM模块表 (apps_llm)

**Provider表** - LLM提供商管理
- `id`: 主键
- `slug`: 唯一标识符 (如: openai, ollama)
- `display_name`: 显示名称
- `enabled`: 是否启用

**ProviderApiKey表** - API密钥管理
- `id`: 主键
- `provider_id`: 外键关联Provider
- `name`: 密钥别名
- `secret`: 加密存储的API密钥
- `organization`: 组织标识
- `api_base`: 自定义API基础URL
- `is_selected`: 是否为当前选中的密钥

**ModelCredential表** - 模型凭据配置
- `id`: 主键
- `provider_id`: 外键关联Provider
- `model_id`: 模型标识符
- `model_name`: 模型显示名称
- `model_type`: 模型类型 (LLM, TEXT_EMBEDDING)
- `base_url`: 模型专用基础URL
- `secret`: 模型专用密钥
- `organization`: 组织标识
- `context_size`: 上下文长度
- `max_tokens`: 最大输出token数
- `completion_mode`: 完成模式 (Chat/Completion)
- `vision_support`: 是否支持视觉
- `function_call_support`: 是否支持函数调用
- `enabled`: 是否启用

#### 2. 知识库模块表 (apps_kb)

**ChunkSettings表** - 分块配置
- `id`: 主键
- `chunk_type`: 分块类型 (general/qa)
- `delimiter`: 分隔符
- `max_length`: 最大长度
- `overlap`: 重叠长度
- `replace_spaces`: 是否替换空格
- `delete_urls`: 是否删除URL
- `qa_format`: Q&A格式开关
- `qa_language`: Q&A语言
- `question_flag`: 问题标识符
- `answer_flag`: 答案标识符
- `qa_max_length`: Q&A最大长度

**KnowledgeBase表** - 知识库
- `id`: 主键
- `name`: 知识库名称
- `description`: 描述
- `index_method`: 索引方法 (hq/eco)
- `retrieval_mode`: 检索模式 (vector/fulltext/hybrid)
- `created_at`: 创建时间
- `updated_at`: 更新时间
- `created_by_id`: 创建者外键
- `chunk_settings_id`: 分块设置外键
- `embedding_model_id`: 嵌入模型外键

**Document表** - 文档
- `id`: 主键
- `knowledge_base_id`: 知识库外键
- `file_name`: 文件名
- `file_path`: 文件路径
- `file_size`: 文件大小
- `file_type`: 文件类型
- `status`: 处理状态 (uploaded/processing/completed/failed)
- `uploaded_at`: 上传时间
- `processed_at`: 处理完成时间

**Chunk表** - 文档分块
- `id`: 主键
- `document_id`: 文档外键
- `chunk_id`: 分块唯一标识
- `content`: 分块内容
- `characters`: 字符数
- `word_count`: 词数
- `chunk_number`: 分块序号
- `created_at`: 创建时间

**Tag表** - 标签
- `id`: 主键
- `knowledge_base_id`: 知识库外键
- `name`: 标签名称
- `description`: 标签描述
- `color`: 标签颜色
- `status`: 标签状态 (active/inactive)
- `created_at`: 创建时间
- `updated_at`: 更新时间
- `created_by_id`: 创建者外键

**RetrievalTestRecord表** - 检索测试记录
- `id`: 主键
- `knowledge_base_id`: 知识库外键
- `query_text`: 查询文本
- `created_at`: 创建时间
- `created_by_id`: 创建者外键

**RetrievalTestResult表** - 检索测试结果
- `id`: 主键
- `test_record_id`: 测试记录外键
- `chunk_id`: 分块外键
- `similarity_score`: 相似度分数
- `rank`: 排名

### 数据库关系说明

1. **一对多关系**:
   - User → KnowledgeBase (一个用户可创建多个知识库)
   - KnowledgeBase → Document (一个知识库包含多个文档)
   - Document → Chunk (一个文档包含多个分块)
   - KnowledgeBase → Tag (一个知识库有多个标签)
   - KnowledgeBase → RetrievalTestRecord (一个知识库有多个测试记录)

2. **多对多关系**:
   - 通过外键实现，如Chunk与RetrievalTestResult的关系

3. **外键约束**:
   - 所有外键都设置了适当的级联删除策略
   - 用户相关数据在用户删除时级联删除
   - 知识库相关数据在知识库删除时级联删除

### 索引策略

1. **主键索引**: 所有表都有自增主键
2. **外键索引**: 所有外键字段自动创建索引
3. **唯一约束**: 
   - Provider.slug
   - ProviderApiKey (provider, name)
   - ModelCredential (provider, model_id)
   - Tag (name, knowledge_base)
4. **复合索引**: 根据查询模式创建复合索引

### 数据存储策略

1. **SQLite/PostgreSQL**: 存储结构化数据
2. **PGVector**: 存储向量嵌入数据
3. **文件系统**: 存储原始文档文件
4. **加密存储**: API密钥等敏感信息加密存储

这个架构图展示了您的RAG后端系统的完整结构，包括各个模块之间的关系、数据流向以及技术栈组成。
