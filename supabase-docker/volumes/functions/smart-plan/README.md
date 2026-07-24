# smart-plan Edge Function

智能规划行程的后端代理。客户端只选择 provider id；API Key 与模型配置都放在 Supabase Secrets。

## 内置 provider

无需 `SMART_PLAN_PROVIDERS` 也有这些 preset：

| id | kind | baseUrl | 默认模型 | key secret |
| --- | --- | --- | --- | --- |
| `deepseek` | `openai-chat` | `https://api.deepseek.com` | `deepseek-chat` | `DEEPSEEK_API_KEY` |
| `openai` | `openai-responses` | `https://api.openai.com/v1` | `gpt-4.1-mini` | `OPENAI_API_KEY` |
| `anthropic` | `anthropic` | `https://api.anthropic.com` | `claude-3-5-haiku-latest` | `ANTHROPIC_API_KEY` |
| `gemini` | `gemini` | `https://generativelanguage.googleapis.com/v1beta` | `gemini-2.5-flash` | `GEMINI_API_KEY` |

## Provider 选择（`provider=auto`）

客户端一般传 `auto`（或不传），此时函数按如下顺序挑 provider，**只会选 key 已配置的**，
保证真的调到大模型、而不是悄悄回退本地模板：

1. `SMART_PLAN_DEFAULT_PROVIDER`（若设置且该 provider 的 key 已配置）；
2. 否则取第一个「key 已配置」的 provider（预设顺序 deepseek → openai → anthropic → gemini）；
3. 一个 key 都没有时回退本地模板，并在响应里带 `warning`。

> 自建 Supabase 里，这些 key 必须透传进 Edge Function 容器才生效：
> 见 `supabase-docker/docker-compose.yml` 的 `functions` 服务 `environment`
> （`OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / … / `SMART_PLAN_*`）。改了 `.env` 或该段后
> 需重建 functions 容器（`docker compose up -d functions`）才会加载新环境变量。

## 推荐配置

只用 DeepSeek：

```bash
# 自建：把 DEEPSEEK_API_KEY 写进 supabase-docker/.env（compose 已透传）
# 托管 Supabase：
supabase secrets set DEEPSEEK_API_KEY=...
supabase functions deploy smart-plan
```

不要把 `DEEPSEEK_API_KEY`（或任何模型 key）放进 Expo 的 `EXPO_PUBLIC_*` 环境变量；这些值会进入客户端包。

新增或覆盖 provider 时，用一个 JSON 注册表：

```bash
supabase secrets set SMART_PLAN_PROVIDERS='{
  "qwen": {
    "kind": "openai-chat",
    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "model": "qwen-plus",
    "apiKeyEnv": "QWEN_API_KEY"
  },
  "openrouter": {
    "kind": "openai-chat",
    "baseUrl": "https://openrouter.ai/api/v1",
    "model": "deepseek/deepseek-chat",
    "apiKeyEnv": "OPENROUTER_API_KEY"
  }
}'
```

然后分别设置 `QWEN_API_KEY` / `OPENROUTER_API_KEY`。

## Provider kind

- `openai-responses`: OpenAI Responses API，endpoint 为 `/responses`。
- `openai-chat`: OpenAI-compatible Chat Completions，endpoint 为 `/chat/completions`。DeepSeek 走这个。
- `anthropic`: Anthropic Messages API。
- `gemini`: Gemini GenerateContent API。
