# Bratnava Frontend (React)  

Gerado em 2026-02-21 a partir do `swagger.json` do BratnavaAPI.

## Rodar
1. Copie `.env.example` para `.env` e ajuste `VITE_API_URL`.
2. Instale e rode:

```bash
npm install
npm run dev
```

## O que tem
- Multi-login (várias contas logadas ao mesmo tempo) + switch de conta ativa
- Interceptor de refresh token (401 -> refresh -> retry)
- Group Picker no Dashboard (seleciona Group ativo por conta)
- Menus e rotas protegidas por role (Admin/GodMode)
- Pages: Groups, Players, TeamColor (ColorPicker + preview uniforme), Matches (wizard), History + Details

## Tipos gerados
`src/api/generated/types.ts` foi gerado a partir de `components.schemas` do OpenAPI.
