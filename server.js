const express = require("express");
const axios = require("axios");
const fs = require("fs");
const https = require("https");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

// Configuração da API do Banco Inter ;)))
const apiPartnersBaseUrl = "https://cdpj.partners.bancointer.com.br";

// Caminhos para os certificados
const cert = fs.readFileSync("/home/aue/apps/middleware-inter/certificados/API_Certificado.crt");
const key = fs.readFileSync("/home/aue/apps/middleware-inter/certificados/API_Chave.key");

// Agente HTTPS
const httpsAgent = new https.Agent({ cert, key });

// Variáveis de cache do token
let cachedToken = null;
let tokenExpirationTime = null;

// Função para obter o token
async function obterToken(clientId, clientSecret) {
  if (cachedToken && tokenExpirationTime && Date.now() < tokenExpirationTime) {
    return cachedToken;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "cob.write cob.read cobv.write cobv.read lotecobv.write lotecobv.read pix.write pix.read webhook.write webhook.read payloadlocation.write payloadlocation.read boleto-cobranca.read boleto-cobranca.write extrato.read pagamento-pix.write pagamento-pix.read pagamento-boleto.read pagamento-boleto.write pagamento-darf.write pagamento-lote.write pagamento-lote.read webhook-banking.read webhook-banking.write",
  });

  const response = await axios.post(`${apiPartnersBaseUrl}/oauth/v2/token`, params, {
    auth: { username: clientId, password: clientSecret },
    httpsAgent,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const data = response.data;
  cachedToken = data.access_token;
  tokenExpirationTime = Date.now() + data.expires_in * 1000;

  return cachedToken;
}

// Função para processar transações Pix
function processarPagamento(data) {
  const status = data.transacaoPix.status; // Status original do Banco Inter
  const valor = data.transacaoPix.valor;
  const historico = data.historico;

  let dataHoraEvento = null;

  // Determinar a data relevante com base no status
  if (status === "PAGO") {
    dataHoraEvento = data.transacaoPix.dataHoraMovimento;
  } else if (status === "CANCELADO") {
    dataHoraEvento = historico.find((h) => h.status === "PIX_CANCELADO")?.dataHoraEvento;
  } else if (status === "AGUARDANDO_APROVACAO") {
    dataHoraEvento = historico.find((h) => h.status === "TRANSACAO_REQUER_APROVACAO")?.dataHoraEvento;
  }

  return {
    status, // Retornar o status exatamente como recebido do Banco Inter
    valor,
    dataHoraPagamento: formatarData(dataHoraEvento),
    mensagem:
      status === "PAGO"
        ? "Pagamento concluído com sucesso"
        : status === "CANCELADO"
        ? "Pagamento cancelado pelo aprovador"
        : "Pagamento em aprovação",
  };
}


// Função utilitária para formatação de datas
function formatarData(dataHora) {
  if (!dataHora) return null;
  const data = new Date(dataHora);

  if (isNaN(data.getTime())) {
    console.error("Data inválida:", dataHora);
    return null;
  }

  // Retorna a data no formato ISO 8601
  return data.toISOString();
}


// Middleware para autenticação
async function autenticar(req, res, next) {
  const { clientId, clientSecret } = req.body;
  if (!clientId || !clientSecret) {
    return res.status(400).json({ status: "ERRO", mensagem: "clientId e clientSecret são obrigatórios" });
  }

  try {
    req.token = await obterToken(clientId, clientSecret);
    next();
  } catch (error) {
    console.error("Erro ao obter token:", error.message);
    res.status(500).json({ status: "ERRO", mensagem: "Erro ao autenticar", detalhes: error.message });
  }
}

// Rota para enviar um pagamento Pix
app.post("/pix", autenticar, async (req, res) => {
  try {
    const { pixData } = req.body;
    const token = req.token;

    // URL do endpoint de pagamento Pix
    const pixUrl = `${apiPartnersBaseUrl}/banking/v2/pix`;

    // Realizar o pagamento
    const pagamentoResponse = await axios.post(pixUrl, pixData, {
      httpsAgent,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    // Obter o código de solicitação do pagamento
    const codigoSolicitacao = pagamentoResponse.data.codigoSolicitacao;

    console.log(`[${new Date().toISOString()}] Pagamento incluído com sucesso. Código: ${codigoSolicitacao}`);

    // Retornar somente o código de solicitação e mensagem para o Airtable
    return res.status(200).json({
      status: "PAGAMENTO_ENVIADO",
      mensagem: "Pagamento incluído no Banco Inter, consulte o status posteriormente.",
      codigoSolicitacao: codigoSolicitacao
    });

  } catch (error) {
    // Capturar e retornar erros
    console.error(`[${new Date().toISOString()}] Erro ao processar Pix:`, error.message);
    return res.status(500).json({
      status: "ERRO",
      mensagem: "Erro ao processar Pix",
      detalhes: error.response ? error.response.data : error.message,
    });
  }
});



// Rota para consultar a situação de um pagamento
app.post("/consulta-pix", autenticar, async (req, res) => {
  try {
    const { codigoSolicitacao } = req.body;
    const token = req.token;

    const consultaUrl = `${apiPartnersBaseUrl}/banking/v2/pix/${codigoSolicitacao}`;
    const response = await axios.get(consultaUrl, {
      httpsAgent,
      headers: { Authorization: `Bearer ${token}` },
    });

    const resultado = processarPagamento(response.data);
    res.status(200).json(resultado);
  } catch (error) {
    console.error("Erro ao consultar pagamento:", error.message);
    res.status(500).json({ status: "ERRO", mensagem: "Erro ao consultar pagamento", detalhes: error.message });
  }
});

// Rota para consultar saldo
app.post("/saldo", autenticar, async (req, res) => {
  try {
    const token = req.token;

    const saldoUrl = `${apiPartnersBaseUrl}/banking/v2/saldo`;
    const response = await axios.get(saldoUrl, {
      httpsAgent,
      headers: { Authorization: `Bearer ${token}` },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Erro ao consultar saldo:", error.message);
    res.status(500).json({ status: "ERRO", mensagem: "Erro ao consultar saldo", detalhes: error.message });
  }
});

// Rota para teste de boleto
app.post("/boleto", autenticar, async (req, res) => {
  try {
    const { boletoData } = req.body;
    
    // Por enquanto, apenas retorna os dados recebidos
    return res.status(200).json({
      status: "DADOS_RECEBIDOS",
      mensagem: "Dados do boleto recebidos com sucesso",
      dados: boletoData
    });

  } catch (error) {
    console.error("Erro ao processar boleto:", error.message);
    return res.status(500).json({
      status: "ERRO",
      mensagem: "Erro ao processar boleto",
      detalhes: error.message
    });
  }
});

// Iniciar o servidor
const PORT = 3005;
app.listen(PORT, () => {
  console.log(`Middleware rodando na porta ${PORT}`);
});
