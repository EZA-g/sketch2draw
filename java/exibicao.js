/* =====================================================
   EXIBIÇÃO - upload e galeria
   As obras ficam salvas no próprio navegador (IndexedDB),
   então continuam lá quando a página é reaberta.
   ===================================================== */

const NOME_BANCO = "sketch2draw-exibicao";
const LOJA = "obras";
const TAMANHO_MAX_ARQUIVO = 15 * 1024 * 1024; // 15 MB
const LADO_MAX_IMAGEM = 1400;                 // px (reduz o peso antes de salvar)

const form = document.getElementById("form-upload");
const campoArquivo = document.getElementById("arquivo");
const nomeArquivo = document.getElementById("nome-arquivo");
const campoTitulo = document.getElementById("titulo");
const campoAutor = document.getElementById("autor");
const campoMoldura = document.getElementById("moldura");
const aviso = document.getElementById("aviso");
const galeria = document.getElementById("galeria");
const vazio = document.getElementById("vazio");
const dialogo = document.getElementById("visualizacao");
const dialogoImg = document.getElementById("visualizacao-img");
const dialogoLegenda = document.getElementById("visualizacao-legenda");

let obraAberta = null;
const urlsCriadas = [];

/* ---------- Banco (IndexedDB) ---------- */
function abrirBanco() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(NOME_BANCO, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(LOJA, { keyPath: "id", autoIncrement: true });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function transacao(modo, fazer) {
    const banco = await abrirBanco();
    return new Promise((resolve, reject) => {
        const t = banco.transaction(LOJA, modo);
        const req = fazer(t.objectStore(LOJA));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error);
    });
}

const salvarObra = (obra) => transacao("readwrite", (s) => s.add(obra));
const listarObras = () => transacao("readonly", (s) => s.getAll());
const apagarObra = (id) => transacao("readwrite", (s) => s.delete(id));

/* ---------- Imagem: redimensiona antes de salvar ---------- */
function prepararImagem(arquivo) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(arquivo);
        const img = new Image();
        img.onload = () => {
            const escala = Math.min(1, LADO_MAX_IMAGEM / Math.max(img.width, img.height));
            const largura = Math.round(img.width * escala);
            const altura = Math.round(img.height * escala);
            const canvas = document.createElement("canvas");
            canvas.width = largura;
            canvas.height = altura;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#fff";            // fundo branco para PNG com transparência
            ctx.fillRect(0, 0, largura, altura);
            ctx.drawImage(img, 0, 0, largura, altura);
            URL.revokeObjectURL(url);
            canvas.toBlob(
                (blob) => (blob ? resolve({ blob, largura, altura }) : reject(new Error("Falha ao processar a imagem."))),
                "image/jpeg",
                0.88
            );
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível ler essa imagem.")); };
        img.src = url;
    });
}

/* ---------- Desenho da galeria ---------- */
function tamanhoDoQuadro(obra) {
    // altura base varia por obra (usa o id) para a parede parecer um conjunto irregular
    const alturas = [210, 250, 290, 330];
    let altura = alturas[obra.id % alturas.length];
    let largura = altura * (obra.largura / obra.altura);
    const maxLargura = 340;
    if (largura > maxLargura) { largura = maxLargura; altura = largura * (obra.altura / obra.largura); }
    return { largura: Math.round(largura), altura: Math.round(altura) };
}

function criarQuadro(obra) {
    const { largura, altura } = tamanhoDoQuadro(obra);
    const url = URL.createObjectURL(obra.imagem);
    urlsCriadas.push(url);

    const quadro = document.createElement("button");
    quadro.type = "button";
    quadro.className = "quadro " + obra.moldura;
    quadro.style.width = largura + "px";
    quadro.style.height = altura + "px";
    quadro.style.animationDelay = (obra.id % 6) * 0.05 + "s";
    quadro.setAttribute("aria-label", `Ver obra: ${obra.titulo || "Sem título"}`);

    const passe = document.createElement("div");
    passe.className = "passepartout";
    const img = document.createElement("img");
    img.src = url;
    img.alt = obra.titulo || "Obra sem título";
    passe.appendChild(img);
    quadro.appendChild(passe);

    quadro.addEventListener("click", () => abrirObra(obra, url));
    return quadro;
}

async function desenharGaleria() {
    const obras = await listarObras();
    urlsCriadas.splice(0).forEach((u) => URL.revokeObjectURL(u));
    galeria.replaceChildren(...obras.map(criarQuadro));
    vazio.hidden = obras.length > 0;
}

/* ---------- Visualização ampliada ---------- */
function abrirObra(obra, url) {
    obraAberta = obra;
    dialogoImg.src = url;
    dialogoImg.alt = obra.titulo || "Obra sem título";
    const titulo = obra.titulo || "Sem título";
    dialogoLegenda.textContent = obra.autor ? `${titulo}, de ${obra.autor}` : titulo;
    dialogo.showModal();
}

document.getElementById("fechar").addEventListener("click", () => dialogo.close());
dialogo.addEventListener("click", (e) => { if (e.target === dialogo) dialogo.close(); });

document.getElementById("remover").addEventListener("click", async () => {
    if (!obraAberta || !confirm("Remover esta obra da parede?")) return;
    await apagarObra(obraAberta.id);
    dialogo.close();
    obraAberta = null;
    desenharGaleria();
});

/* ---------- Formulário ---------- */
function mostrarAviso(texto, ok = false) {
    aviso.textContent = texto;
    aviso.classList.toggle("ok", ok);
}

campoArquivo.addEventListener("change", () => {
    nomeArquivo.textContent = campoArquivo.files[0] ? campoArquivo.files[0].name : "nenhum arquivo";
    mostrarAviso("");
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const arquivo = campoArquivo.files[0];

    if (!arquivo) return mostrarAviso("Escolha uma imagem primeiro.");
    if (!arquivo.type.startsWith("image/")) return mostrarAviso("O arquivo precisa ser uma imagem.");
    if (arquivo.size > TAMANHO_MAX_ARQUIVO) return mostrarAviso("A imagem passa de 15 MB. Escolha uma menor.");

    try {
        mostrarAviso("Enviando...", true);
        const { blob, largura, altura } = await prepararImagem(arquivo);
        await salvarObra({
            titulo: campoTitulo.value.trim(),
            autor: campoAutor.value.trim(),
            moldura: campoMoldura.value,
            imagem: blob,
            largura,
            altura,
            data: Date.now(),
        });
        form.reset();
        nomeArquivo.textContent = "nenhum arquivo";
        mostrarAviso("Obra exposta!", true);
        desenharGaleria();
    } catch (erro) {
        mostrarAviso(erro.message || "Não foi possível salvar a obra.");
    }
});

desenharGaleria().catch(() => mostrarAviso("Seu navegador não permitiu salvar as obras."));
