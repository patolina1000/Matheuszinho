
Guia de Início Rápido

Bem-vindo à documentação da API da Paradise . Siga estes passos para começar a integrar nossa API de pagamentos PIX em sua aplicação.

    Crie sua Conta de Loja: Entre em contato com o administrador da plataforma para criar sua conta. Você receberá um e-mail e uma senha para acessar o seu portal de cliente.
    Obtenha sua Chave Secreta: Faça login no seu portal, vá para a aba "Configurações e API" e copie sua Chave Secreta (Secret Key).
    Autentique suas Requisições: Para toda chamada à API, inclua sua Chave Secreta no cabeçalho HTTP X-API-Key.
    Crie sua Primeira Transação: Use o endpoint POST /api/v1/transaction.php para gerar sua primeira cobrança PIX.
    Receba Notificações: Configure uma URL de Webhook no seu portal para ser notificado em tempo real sobre as mudanças de status.

Autenticação

A autenticação é feita via API Key. Envie sua Chave Secreta no cabeçalho X-API-Key em todas as requisições. Requisições sem uma chave válida retornarão um erro 401 Unauthorized.
Exemplo de Requisição Autenticada (cURL)

curl --location 'https://multi.paradisepags.com/api/v1/transaction.php' \
--header 'X-API-Key: sk_sua_chave_secreta_aqui' \
--header 'Content-Type: application/json' \
--data-raw '{ ... }'

Recurso: Transações

O recurso de transações é o principal da API, permitindo a criação e consulta de pagamentos.
Criar Transação

POST
/api/v1/transaction.php

Este endpoint cria uma nova transação. Atualmente, apenas o método de pagamento pix é suportado.
Atributos do Objeto transaction (Envio)
Campo 	Tipo 	Obrigatório 	Descrição
amount 	Integer 	Sim 	Valor da transação em centavos. Ex: 1000 para R$ 10,00.
description 	String 	Sim 	Nome do Produto.
reference 	String 	Sim 	Seu identificador único para a transação.
postback_url 	String 	Opcional 	URL para receber webhooks desta transação específica.
productHash 	String 	Sim 	O código (hash) do produto que está sendo vendido. Encontrado nos detalhes do produto no painel.
orderbump 	String or Array 	Opcional 	O código (hash) ou um array de códigos das ofertas de Order Bump.
customer 	Object 	Sim 	Objeto com os dados do cliente.
tracking 	Object 	Opcional 	Objeto com os parâmetros de rastreamento (UTMs) para integração com a Utmify.
Atributos do Objeto tracking (Opcional)

Envie este objeto para rastrear a origem de suas vendas.
Campo 	Tipo 	Descrição
utm_source 	String 	Origem do tráfego (Ex: google, facebook).
utm_medium 	String 	Mídia da campanha (Ex: cpc, social).
utm_campaign 	String 	Nome da campanha.
utm_content 	String 	Conteúdo do anúncio.
utm_term 	String 	Palavra-chave da campanha.
src 	String 	Parâmetro src da URL.
sck 	String 	Parâmetro sck da URL.
Atributos do Objeto splits (Opcional)

Envie este campo para dividir o valor da venda entre múltiplos recebedores (coprodutores, parceiros, etc.). A taxa da plataforma será descontada integralmente da conta principal que está realizando a transação.
Campo 	Tipo 	Descrição
splits 	Array de Objetos 	Um array contendo um ou mais objetos, cada um representando uma parte da divisão.

Cada objeto dentro do array splits deve conter:
Campo 	Tipo 	Obrigatório 	Descrição
recipientId 	Integer 	Sim 	O ID da Loja (numérico) do recebedor. Este ID pode ser encontrado no painel do recebedor.
amount 	Integer 	Sim 	Valor a ser creditado para o recebedor em centavos. Ex: 2000 para R$ 20,00.
Nota sobre IDs: Na resposta da criação, você receberá dois IDs: transaction_id (o ID numérico interno da Paradise ) e id (que é um espelho da sua reference). Você pode usar qualquer um deles para futuras consultas.
Atributos do Objeto customer (Envio)
Campo 	Tipo 	Obrigatório 	Descrição
name 	String 	Sim 	Nome completo do cliente.
email 	String 	Sim 	E-mail válido do cliente.
document 	String 	Sim 	CPF ou CNPJ do cliente (apenas números).
phone 	String 	Sim 	Telefone do cliente com DDD (apenas números).
Exemplo de Requisição Completa (cURL)

curl --location 'https://multi.paradisepags.com/api/v1/transaction.php' \
--header 'X-API-Key: sk_sua_chave_secreta_aqui' \
--header 'Content-Type: application/json' \
--data-raw '{
    "amount": 1000,
    "description": "Produto Teste ",
    "reference": "REF-12345",
    "customer": {
        "name": "João da Silva",
        "email": "joao@teste.com",
        "phone": "11999999999",
        "document": "05531510101"
    },

        "orderbump": [
        "ob_hash_da_oferta_1",
        "ob_hash_da_oferta_2"
    ],
    "tracking": {
        "utm_source": "FB",
        "utm_campaign": "CAMPANHA_2|413591587909524",
        "utm_medium": "CONJUNTO_2|498046723566488",
        "utm_content": "ANUNCIO_2|504346051220592",
        "utm_term": "Instagram_Feed",
        "src": "valor_src_aqui",
        "sck": "valor_sck_aqui"
    },
    "splits": [
        {
            "recipientId": ID_DA_CONTA,
            "amount": 500
        }
    ]


}'

Exemplo de Resposta (Sucesso)

{
    "status": "success",
    "transaction_id": 238,
    "id": "PED123-CLIENTE456",
    "qr_code": "00020126...6304ABCD",
    "qr_code_base64": "data:image/png;base64,iVBORw0KGgo...",
    "amount": 1000,
    "acquirer": "ParadiseBank",
    "attempts": 1,
    "expires_at": "2025-08-22 21:30:00"
}

Consultar Transação por ID

GET
/api/v1/query.php?action=get_transaction&id={id}

Busca os detalhes completos de uma única transação usando o ID interno da Paradise .
Atributos do Objeto de Resposta
Campo 	Tipo 	Descrição
id 	Integer 	O ID interno da transação na Paradise .
external_id 	String 	O seu ID interno.
status 	String 	O status atual da transação (approved, pending, etc.).
customer_data 	Object 	Uma cópia exata do JSON que você enviou na criação da transação.
Exemplo de Resposta (Sucesso)

{
    "id": 158,
    "external_id": "LOJA-TESTE-1755739430",
    "status": "pending",
    "amount": 200,
    "created_at": "2025-08-21 22:23:53",
    "updated_at": "2025-08-21 22:23:53",
    "acquirer_name": "ParadiseBank",
    "customer_data": { ... },
    "attempts_data": [ ... ],
    "amount_in_reais": "2,00"
}

Recurso: Consultas

Endpoints para buscar informações sobre transações já existentes.
Consultar Transação por ID Interno

GET
/api/v1/query.php?action=get_transaction&id={id}

Busca os detalhes completos de uma única transação usando o ID numérico gerado pela Paradise no momento da criação.
Exemplo de Resposta (Sucesso)

{
    "id": 158,
    "external_id": "LOJA-TESTE-1755739430",
    "status": "pending",
    "amount": 200,
    "created_at": "2025-08-21 22:23:53",
    "updated_at": "2025-08-21 22:23:53",
    "customer_data": { ... },
    "attempts_data": [ ... ],
    "amount_in_reais": "2,00"
}

Consultar Transação por Referência (external_id)

GET
/api/v1/query.php?action=list_transactions&external_id={sua_referencia}

Busca uma ou mais transações usando a sua referência (o campo reference que você enviou na criação).
Parâmetros de Query
Campo 	Tipo 	Obrigatório 	Descrição
action 	String 	Sim 	Deve ser list_transactions.
external_id 	String 	Sim 	A sua referência única para a transação.
Exemplo de Resposta (Sucesso)

A resposta é sempre um array, mesmo que encontre apenas uma transação.

[
    {
        "id": 158,
        "external_id": "LOJA-TESTE-1755739430",
        "status": "pending",
        "amount": 200,
        "created_at": "2025-08-21 22:23:53",
        "updated_at": "2025-08-21 22:23:53",
        "amount_in_reais": "2,00"
    }
]

Recurso: Reembolsos

Este recurso permite que você inicie o processo de devolução de uma transação PIX que já foi paga.
Solicitar Reembolso

POST
/api/v1/refund.php

Inicia o estorno de uma transação específica. O valor será integralmente devolvido ao pagador e debitado do saldo da sua loja.
Parâmetros do Corpo (Body)
Campo 	Tipo 	Obrigatório 	Descrição
transaction_id 	Integer 	Sim 	O ID interno da transação na Paradise (o número que você recebe na criação e nos webhooks).
Exemplo de Requisição (cURL)

curl --location --request POST 'https://multi.paradisepags.com/api/v1/refund.php' \
--header 'X-API-Key: sk_sua_chave_secreta_aqui' \
--header 'Content-Type: application/json' \
--data-raw '{
    "transaction_id": 158
}'

Resposta de Sucesso (200 OK)

{
    "success": true,
    "message": "Reembolso processado com sucesso."
}

Respostas de Erro Comuns

// Transação não encontrada ou não pertence à sua loja (404 Not Found)
{
    "success": false,
    "message": "Permissão negada."
}

// Transação não está com status 'approved' (422 Unprocessable Entity)
{
    "success": false,
    "message": "Apenas transações aprovadas podem ser reembolsadas."
}

Webhooks (Postbacks)

Quando o status de uma transação muda, enviamos uma notificação POST para a sua URL de webhook. Seu servidor deve responder com um status HTTP 200 OK para confirmar o recebimento.
Eventos de Webhook

O campo status no payload do webhook indicará o novo estado da transação. Os valores possíveis são:

    pending: A transação foi criada e aguarda pagamento.
    approved: O pagamento foi confirmado com sucesso.
    failed: O pagamento foi recusado, cancelado ou expirou.
    refunded: O valor da transação foi devolvido ao cliente.

Exemplo de Payload (Pagamento Aprovado)

{
  "transaction_id": "469",
  "external_id": "a9dc785ae27c286341b4dcb9a3c",
  "status": "approved",
  "amount": 690,
  "payment_method": "pix",
  "customer": {
    "name": "client joao",
    "email": "email@gmail.com",
    "document": "01111111111",
    "phone": "numero"
  },
  "raw_status": "COMPLETED",
  "webhook_type": "transaction",
  "timestamp": "2025-09-09 09:17:56",
  "tracking": {
    "utm_source": "Teste"
    "utm_campaign": "Teste"
    "utm_medium": "Teste"   
    "utm_content": "Teste"
    "utm_term": "Teste"
    "src": "Teste"
    "sck": "Teste"
                
  }
}

Códigos de Erro

A API utiliza os códigos de status HTTP padrão para indicar o sucesso ou falha de uma requisição.
Código 	Significado 	Causa Comum
200 OK 	Sucesso 	A requisição foi bem-sucedida.
400 Bad Request 	Requisição Inválida 	Faltam campos obrigatórios ou o JSON está mal formatado.
401 Unauthorized 	Não Autorizado 	A X-API-Key está ausente, é inválida ou a loja está inativa.
404 Not Found 	Não Encontrado 	O recurso solicitado não existe.
500 Internal Server Error 	Erro no Servidor 	Ocorreu um erro inesperado em nosso servidor.