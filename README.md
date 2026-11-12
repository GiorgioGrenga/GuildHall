# Guildhall

Applicazione React + TypeScript per organizzare sessioni GDR, votare le disponibilità e prenotare posti ai tavoli. Autenticazione e dati sono gestiti da Supabase; non ci sono account, gruppi o prenotazioni demo.

## Avvio locale

1. Crea un progetto Supabase.
2. Nel SQL Editor del progetto esegui, nell’ordine, `supabase/migrations/202611120001_initial_schema.sql` e `supabase/migrations/202611120002_workspaces_rooms_table_masters.sql`. La seconda migrazione aggiunge sale, più spazi per account, Master assegnati ai tavoli e lo storage immagini.
3. Copia `.env.example` in `.env.local` e configura:

   ```dotenv
   VITE_SUPABASE_URL=https://<project-id>.supabase.co
   VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
   ```

4. Avvia l’app:

   ```bash
   npm install
   npm run dev
   ```

Ogni account può creare più spazi o unirsi a quelli di altri. Chi crea uno spazio ne è il proprietario e gestisce gruppi, inviti, sale e tavoli; tutti i membri invitati vedono le sale condivise dello spazio. Il proprietario può assegnare un Master a un singolo tavolo: quel Master può gestire e rimuovere i posti e modificare o eliminare il tavolo assegnato, senza privilegi sugli altri tavoli o sullo spazio. I Master di tavolo possono prenotare un posto come tutti gli altri giocatori.

Il proprietario crea gruppi e condivide i codici d’invito; i giocatori si registrano, confermano l’email e inseriscono il codice per unirsi. I codici scadono dopo 30 giorni e il server ne conserva solo l’hash. Profili e copertine accettano un URL oppure un’immagine caricata (JPG, PNG, WebP o GIF fino a 5 MB) nello storage Supabase.

## Pubblicazione su Render

Il blueprint `render.yaml` configura il progetto come sito statico Vite con fallback SPA e variabili d’ambiente non sincronizzate.

1. Pubblica il repository su GitHub senza includere `.env.local`.
2. In Render scegli **New → Blueprint** e collega il repository; Render leggerà `render.yaml`.
3. Inserisci `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nei valori richiesti dal blueprint e avvia il deploy.
4. In Supabase → Authentication → URL Configuration imposta l’URL Render tra i **Site URL** e gli **Additional Redirect URLs**.
5. In Supabase verifica le impostazioni email/SMTP prima di invitare utenti reali.

Nel frontend va configurata esclusivamente la chiave pubblica anon/publishable: non inserire mai `service_role` né altre chiavi segrete nelle variabili `VITE_*`.

## Verifiche

```bash
npm run build
npm run lint
```
