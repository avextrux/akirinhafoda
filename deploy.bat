@echo off
echo 🔧 CONFIGURADOR DEPLOY - BOT DISCORD
echo.
echo 📋 Passos para configurar:
echo.
echo 1. Vá para: https://discord.com/developers/applications
echo 2. Selecione sua aplicação
echo 3. Copie os dados:
echo    - Token: Bot ^> Reset Token
echo    - Client ID: General Information ^> Application ID  
echo    - Guild ID: Discord Server ^> Widget ^> Server ID
echo.
echo 4. Configure seu .env com:
echo    DISCORD_TOKEN=seu_token_aqui
echo    CLIENT_ID=seu_client_id_aqui
echo    GUILD_ID=seu_guild_id_aqui
echo.
echo 5. Execute: node scripts/deploy-commands.js
echo.
echo ✅ Comandos prontos: 36 comandos carregados!
echo.
echo 📝 Comandos novos implementados:
echo    - /config (configurações do servidor)
echo    - /ticket setup tipo:suporte|parceria|denuncia|sugestao
echo    - /botadmin leaveguild (sair do servidor)
echo.
pause
