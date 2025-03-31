# Middleware Inter

Middleware para integração com a API do Banco Inter, facilitando operações de pagamento PIX e consultas bancárias.

## Funcionalidades

- Autenticação com a API do Banco Inter
- Realização de pagamentos PIX
- Consulta de status de pagamentos PIX
- Consulta de saldo da conta
- Cache de token de autenticação
- Tratamento de erros e respostas padronizadas

## Requisitos

- Node.js
- Certificados de API do Banco Inter (API_Certificado.crt e API_Chave.key)
- Credenciais de API (clientId e clientSecret)

## Instalação

1. Clone o repositório
2. Instale as dependências:
```bash
npm install
```
3. Configure os certificados:
   - Crie uma pasta `certificados` no diretório raiz
   - Adicione seus certificados do Banco Inter:
     - `API_Certificado.crt`
     - `API_Chave.key`

## Configuração

O servidor roda na porta 3005 por padrão. Os certificados devem estar localizados em:
```
/home/aue/apps/middleware-inter/certificados/
```

## Endpoints

### POST /pix
Realiza um pagamento PIX.

**Corpo da requisição:**
```json
{
  "clientId": "seu_client_id",
  "clientSecret": "seu_client_secret",
  "pixData": {
    // Dados do pagamento PIX
  }
}
```

### POST /consulta-pix
Consulta o status de um pagamento PIX.

**Corpo da requisição:**
```json
{
  "clientId": "seu_client_id",
  "clientSecret": "seu_client_secret",
  "codigoSolicitacao": "codigo_do_pagamento"
}
```

### POST /saldo
Consulta o saldo da conta.

**Corpo da requisição:**
```json
{
  "clientId": "seu_client_id",
  "clientSecret": "seu_client_secret"
}
```

### POST /boleto
Endpoint para teste de processamento de boletos.

**Corpo da requisição:**
```json
{
  "clientId": "seu_client_id",
  "clientSecret": "seu_client_secret",
  "boletoData": {
    // Dados do boleto para teste
  }
}
```

**Resposta de sucesso:**
```json
{
  "status": "DADOS_RECEBIDOS",
  "mensagem": "Dados do boleto recebidos com sucesso",
  "dados": {
    // Dados do boleto recebidos
  }
}
```

## Segurança

- Os certificados e chaves privadas não são versionados no repositório
- Autenticação via clientId e clientSecret em todas as requisições
- Comunicação segura via HTTPS
- Cache de token para otimização de requisições

## Tecnologias Utilizadas

- Node.js
- Express
- Axios
- HTTPS
- Body Parser

## Licença

ISC