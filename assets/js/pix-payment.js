document.addEventListener('DOMContentLoaded', function() {
    
    // --- CONFIGURAÇÃO E SELETORES ---
    // Usar caminho relativo para funcionar em produção e local (desde que servido pelo mesmo backend)
    const API_BASE_URL = '/api/pix';
    // Em um app real, isso viria de um sistema de autenticação/sessão
    const AUTH_TOKEN = 'seu_token_seguro_front_to_back'; 

    const modalOverlay = document.getElementById('pix-modal-overlay');
    const modalCloseBtn = document.getElementById('pix-modal-close');
    const qrContainer = document.getElementById('pix-qrcode-container');
    const qrImage = document.getElementById('pix-qr-image');
    const copyInput = document.getElementById('pix-key-input');
    const copyBtn = document.getElementById('pix-copy-btn');
    const toast = document.getElementById('pix-toast');
    
    // Elementos de dados
    const elAmount = document.getElementById('pix-amount');
    const elDesc = document.getElementById('pix-description');
    const elBenefits = document.querySelector('.pix-modal__benefits');
    
    // Estado do Polling
    let pollingInterval = null;
    let currentTxId = null;

    // Formato de Moeda Brasileiro
    const formatter = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

    // Função auxiliar para gerar CPF válido (para testes)
    function generateCPF() {
        const rnd = (n) => Math.round(Math.random() * n);
        const mod = (base, div) => Math.round(base - Math.floor(base / div) * div);
        const n = Array(9).fill(0).map(() => rnd(9));

        let d1 = n.reduce((total, num, i) => total + (num * (10 - i)), 0);
        d1 = 11 - mod(d1, 11);
        if (d1 >= 10) d1 = 0;

        let d2 = n.reduce((total, num, i) => total + (num * (11 - i)), 0) + (d1 * 2);
        d2 = 11 - mod(d2, 11);
        if (d2 >= 10) d2 = 0;

        return `${n.join('')}${d1}${d2}`;
    }

    // --- FUNÇÕES DE ABERTURA ---

    // Função principal chamada ao clicar nos botões de pagamento
    async function openPixModal(btnDataset) {
        const price = parseFloat(btnDataset.price);
        const description = btnDataset.description;
        const planId = btnDataset.plan;

        // 1. Resetar modal e UI
        resetModalState();
        
        // 2. Exibir dados iniciais
        elAmount.innerText = formatter.format(price);
        elDesc.innerText = description;
        copyInput.value = "Gerando chave PIX...";
        
        // 3. Abrir Modal
        modalOverlay.classList.add('is-open');
        modalOverlay.setAttribute('aria-hidden', 'false');
        
        // Foco no botão de fechar para acessibilidade
        setTimeout(() => modalCloseBtn.focus(), 100);

        try {
            // 4. Dados do Cliente Aleatórios para Teste (Evita deduplicação na Paradise)
            const randomId = Math.floor(Math.random() * 10000);
            const mockCustomer = {
                name: `Cliente Teste ${randomId}`,
                email: `cliente.teste.${randomId}@exemplo.com`,
                document: generateCPF(), // Gera CPF válido/aleatório
                phone: "11999999999"
            };

            // 5. Buscar dados do PIX no Backend
            const pixData = await createPixCharge(price, planId, mockCustomer);
            
            // 6. Preencher dados reais
            if (pixData.pixKey) {
                copyInput.value = pixData.pixKey;
                // Passamos pixKey (string) e qrcode (base64 image)
                renderQRCode(pixData.pixKey, pixData.qrcode);
                
                // Iniciar Polling de Pagamento
                if (pixData.txid) {
                    currentTxId = pixData.txid;
                    startPolling(pixData.txid);
                }
            } else {
                throw new Error("Dados do PIX incompletos");
            }
            
        } catch (error) {
            console.error("Erro ao gerar PIX:", error);
            showErrorState(error.message || "Erro ao conectar com o servidor.");
        }
    }

    // Chamada ao Backend para Criar Cobrança
    async function createPixCharge(price, planId, customer) {
        const response = await fetch(`${API_BASE_URL}/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            },
            body: JSON.stringify({
                price: price,
                planId: planId,
                customer: customer
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Erro na criação do PIX');
        }

        return await response.json();
    }

    // Lógica Simplificada: Usa a imagem Base64 do backend
    function renderQRCode(qrString, qrBase64) {
        qrContainer.innerHTML = ''; // Limpa loader ou erro
        
        // Prioridade: Usar a imagem Base64 que vem pronta da API
        if (qrBase64) {
            const img = document.createElement('img');
            // Se já vier com o prefixo data:image..., usa direto. Senão, adiciona.
            img.src = qrBase64.startsWith('data:image') ? qrBase64 : `data:image/png;base64,${qrBase64}`;
            img.alt = "QR Code PIX";
            img.style.maxWidth = "100%";
            img.style.height = "auto";
            qrContainer.appendChild(img);
        } 
        // Fallback: Se não tiver imagem, tenta gerar (mas a API da Paradise costuma mandar a imagem)
        else if (qrString) {
             if (typeof QRCode !== 'undefined') {
                new QRCode(qrContainer, {
                    text: qrString,
                    width: 200,
                    height: 200
                });
             } else {
                 qrContainer.innerText = 'QR Code disponível. Use o Copia e Cola abaixo.';
             }
        }
    }

    // --- POLLING DE STATUS ---

    function startPolling(txid) {
        stopPolling(); // Garante que não haja duplicidade
        
        pollingInterval = setInterval(async () => {
            try {
                const status = await checkPixStatus(txid);
                
                if (status === 'approved' || status === 'paid') {
                    stopPolling();
                    showSuccessState();
                } else if (status === 'failed' || status === 'refunded') {
                    stopPolling();
                    showErrorState("Pagamento falhou ou foi expirado.");
                }
                // Se 'pending', continua tentando...
                
            } catch (err) {
                console.warn("Erro no polling:", err);
                // Não para o polling por erro de rede temporário
            }
        }, 5000); // Verifica a cada 5 segundos
    }

    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    async function checkPixStatus(txid) {
        const response = await fetch(`${API_BASE_URL}/status/${txid}`, {
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`
            }
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.status;
    }

    // --- ESTADOS DE UI ---

    function resetModalState() {
        qrContainer.innerHTML = '<div style="padding:20px;">Carregando QR Code...</div>'; // Loader simples
        copyInput.value = "";
        elBenefits.style.display = 'block';
        stopPolling();
    }

    function showErrorState(msg) {
        qrContainer.innerHTML = `<div style="color: #ff4629; text-align:center; padding: 20px;">
            <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 10px;"></i><br>
            ${msg}
        </div>`;
        copyInput.value = "Erro";
    }

    function showSuccessState() {
        qrContainer.innerHTML = `<div style="color: #4caf50; text-align:center; padding: 20px;">
            <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 10px;"></i><br>
            <strong>Pagamento Aprovado!</strong>
        </div>`;
        elDesc.innerText = "Acesso liberado com sucesso.";
        
        // Fechar modal após 3 segundos
        setTimeout(() => {
            closePixModal();
            // Aqui você pode redirecionar o usuário ou desbloquear o conteúdo na página
            alert("Conteúdo desbloqueado! (Simulação)");
        }, 3000);
    }

    // --- EVENT LISTENERS ---

    // Captura cliques em QUALQUER botão com data-pix="true"
    document.body.addEventListener('click', function(e) {
        // Procura o botão clicado ou seu pai (caso clique no span/icone dentro do botão)
        const btn = e.target.closest('[data-pix="true"]');
        
        if (btn) {
            e.preventDefault();
            openPixModal(btn.dataset);
        }
    });

    // Copiar Chave
    copyBtn.addEventListener('click', () => {
        const textToCopy = copyInput.value;
        if (!textToCopy || textToCopy.includes("...")) return;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast();
        }).catch(err => {
            copyInput.select();
            document.execCommand('copy');
            showToast();
        });
    });

    // --- FECHAMENTO E ACESSIBILIDADE ---

    function closePixModal() {
        modalOverlay.classList.remove('is-open');
        modalOverlay.setAttribute('aria-hidden', 'true');
        stopPolling();
    }

    modalCloseBtn.addEventListener('click', closePixModal);

    // Fechar ao clicar fora (no overlay)
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closePixModal();
        }
    });

    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('is-open')) {
            closePixModal();
        }
    });
});
