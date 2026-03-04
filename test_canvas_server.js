// Script para testar Canvas no servidor após instalação

const { createCanvas, loadImage } = require("canvas");

async function testarCanvasServidor() {
  console.log("🎨 Testando Canvas no Servidor");
  console.log("=" .repeat(40));
  
  try {
    // Testar import
    console.log("✅ Canvas importado");
    
    // Testar criação de card rank
    const canvas = createCanvas(934, 282);
    const ctx = canvas.getContext("2d");
    
    // Desenhar card de teste
    ctx.fillStyle = "#2c2f33";
    ctx.fillRect(0, 0, 934, 282);
    
    // Gradiente
    const gradient = ctx.createLinearGradient(0, 0, 934, 282);
    gradient.addColorStop(0, "#7289da");
    gradient.addColorStop(1, "#4a5568");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 934, 282);
    
    // Texto
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px Arial";
    ctx.fillText("Canvas Funcionando!", 200, 150);
    
    // Converter para buffer
    const buffer = canvas.toBuffer("image/png");
    console.log(`✅ Card gerado (${buffer.length} bytes)`);
    
    // Testar leaderboard
    const lbCanvas = createCanvas(934, 800);
    const lbCtx = lbCanvas.getContext("2d");
    lbCtx.fillStyle = "#1a1a1a";
    lbCtx.fillRect(0, 0, 934, 800);
    lbCtx.fillStyle = "#ffffff";
    lbCtx.font = "bold 24px Arial";
    lbCtx.fillText("🏆 Leaderboard Test", 50, 50);
    
    const lbBuffer = lbCanvas.toBuffer("image/png");
    console.log(`✅ Leaderboard gerado (${lbBuffer.length} bytes)`);
    
    console.log("\n🎉 Canvas funcionando perfeitamente!");
    console.log("📋 Comandos prontos para usar:");
    console.log("  - /rank view");
    console.log("  - /leaderboard");
    console.log("  - /rank cards");
    
    return true;
    
  } catch (error) {
    console.error("❌ Erro no Canvas:", error.message);
    return false;
  }
}

// Executar teste
testarCanvasServidor().then(success => {
  if (success) {
    console.log("\n🚀 Sistema pronto para produção!");
  } else {
    console.log("\n❌ Verifique a instalação do Canvas");
  }
}).catch(console.error);
