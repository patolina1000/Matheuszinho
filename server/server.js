require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path'); // Importar path

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// --- SERVIR FRONTEND ---
// Serve arquivos estáticos da pasta pai (Pagina_privacy)
app.use(express.static(path.join(__dirname, '../')));

// --- API ROUTES ---

// Configurações da API Paradise
const PARADISE_API_URL = 'https://multi.paradisepags.com/api/v1';
const API_KEY = process.env.PARADISE_API_KEY;
// const SECRET_KEY = process.env.PARADISE_SECRET_KEY; // Removido pois não é utilizado

// Middleware de Autenticação Simples (Bearer Token)
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticação ausente ou inválido' });
    }

    const token = authHeader.split(' ')[1];
    
    // Em produção, valide este token contra um banco de dados ou JWT real.
    // Para este exemplo, usamos uma chave estática no .env
    if (token !== process.env.APP_AUTH_TOKEN) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    next();
};

/**
 * POST /api/pix/create
 * Cria uma cobrança PIX na Paradise
 */
app.post('/api/pix/create', authenticate, async (req, res) => {
    try {
        const { planId, price, customer, productId } = req.body;

        // Validação básica
        if (!price || price <= 0) {
            return res.status(400).json({ error: 'Preço inválido' });
        }
        if (!customer || !customer.name || !customer.email || !customer.document || !customer.phone) {
            return res.status(400).json({ error: 'Dados do cliente incompletos (nome, email, document, phone)' });
        }

        // Formata o valor para centavos (Paradise espera integer)
        // Assume que 'price' vem como float (ex: 19.90) -> 1990
        const amountInCents = Math.round(price * 100);
        
        // Gera uma referência única
        const reference = `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // Payload para Paradise
        const paradisePayload = {
            amount: amountInCents,
            description: `Plano ${planId || 'Assinatura'}`,
            reference: reference,
            productHash: productId || process.env.DEFAULT_PRODUCT_HASH, // Fallback se não enviar productId
            customer: {
                name: customer.name,
                email: customer.email,
                document: customer.document.replace(/\D/g, ''), // Remove formatação
                phone: customer.phone.replace(/\D/g, '')
            },
            // Opcionais: tracking, splits, postback_url
        };

        console.log('Enviando para Paradise:', JSON.stringify(paradisePayload, null, 2));

        const response = await axios.post(`${PARADISE_API_URL}/transaction.php`, paradisePayload, {
            headers: {
                'X-API-Key': API_KEY,
                'Content-Type': 'application/json'
            }
        });

        const data = response.data;

        if (data.status === 'success' || data.qr_code) {
            // Formata resposta conforme solicitado
            return res.status(200).json({
                amount: price,
                formatted: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price),
                qrcode: data.qr_code_base64, // Base64 image
                pixKey: data.qr_code, // Copia e Cola
                txid: data.transaction_id, // ID interno da Paradise
                reference: data.id, // ID externo
                expiresAt: data.expires_at
            });
        } else {
            console.error('Erro Paradise:', data);
            return res.status(500).json({ error: 'Erro ao gerar PIX na operadora', details: data });
        }

    } catch (error) {
        console.error('Erro interno:', error.message);
        if (error.response) {
            console.error('Erro resposta PSP:', error.response.data);
            return res.status(error.response.status).json({ error: 'Erro na PSP', details: error.response.data });
        }
        return res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

/**
 * GET /api/pix/status/:txid
 * Verifica o status da transação
 */
app.get('/api/pix/status/:txid', authenticate, async (req, res) => {
    try {
        const { txid } = req.params;

        if (!txid) {
            return res.status(400).json({ error: 'txid obrigatório' });
        }

        // Chama endpoint de consulta da Paradise
        // /api/v1/query.php?action=get_transaction&id={id}
        const response = await axios.get(`${PARADISE_API_URL}/query.php`, {
            params: {
                action: 'get_transaction',
                id: txid
            },
            headers: {
                'X-API-Key': API_KEY
            }
        });

        const data = response.data;

        // Se retornou o objeto transaction
        if (data && data.id) {
            return res.status(200).json({
                txid: data.id,
                status: data.status, // pending, approved, failed, refunded
                amount: data.amount,
                paidAt: data.updated_at // Aproximação, dependendo do status
            });
        } else {
            return res.status(404).json({ error: 'Transação não encontrada' });
        }

    } catch (error) {
        console.error('Erro ao consultar status:', error.message);
        return res.status(500).json({ error: 'Erro ao consultar status' });
    }
});

// Todas as outras requisições retornam o index.html (SPA fallback)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
