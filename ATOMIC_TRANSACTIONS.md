# 🛡️ Transazioni Atomiche - Guida Implementazione

## Problema Risolto

**Prima (Inserimenti Multipli):**
```
Client → DB: INSERT session
Client ← DB: OK, session_id=123
Client → DB: INSERT group 1
Client ← DB: OK
Client → DB: INSERT group 2
❌ CONNESSIONE CADE
```
**Risultato:** Sessione 123 salvata ma incompleta (mancano gruppi/set)

**Dopo (RPC Atomica):**
```
Client → DB: RPC insert_full_training_session(session + groups + sets)
DB: BEGIN TRANSACTION
DB: INSERT session
DB: INSERT group 1
DB: INSERT group 2
DB: INSERT all sets
❌ CONNESSIONE CADE
DB: ROLLBACK (nulla salvato)
```
**Risultato:** O tutto salvato o niente. Database sempre consistente.

---

## Installazione

### 1. Crea la Stored Procedure in Supabase

1. Apri [Supabase Dashboard](https://supabase.com/dashboard)
2. Vai al tuo progetto → **SQL Editor**
3. Clicca **New Query**
4. Copia il contenuto di `supabase-rpc-insert-session.sql`
5. Clicca **Run** (o CTRL+Enter)
6. Verifica il messaggio: `Success. No rows returned`

### 2. Verifica l'Installazione

Esegui questo test nel SQL Editor:

```sql
SELECT insert_full_training_session(
  '2026-01-19'::DATE,
  'Test RPC Session',
  'test',
  NULL,
  7,
  'ottimo',
  'Test transazione atomica',
  '[
    {
      "order_index": 0,
      "name": "Gruppo Test",
      "notes": null,
      "sets": [
        {
          "exercise_name": "Sprint 100m",
          "category": "sprint",
          "sets": 1,
          "reps": 1,
          "weight_kg": null,
          "distance_m": 100,
          "time_s": 12.5,
          "recovery_s": 180,
          "notes": null,
          "details": {}
        }
      ]
    }
  ]'::JSONB
);
```

**Output atteso:** Un UUID (es. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### 3. Il Codice JavaScript è già aggiornato

✅ `src/services/trainingService.js` usa già `supabase.rpc('insert_full_training_session', ...)`

---

## Vantaggi Ottenuti

| Aspetto | Prima | Dopo |
|---------|-------|------|
| **Chiamate di rete** | 1 + N_gruppi + N_set (es. 20+) | **1 sola** |
| **Velocità** | ~500-1000ms | **~100-200ms** |
| **Sicurezza dati** | ❌ Possibili insert parziali | ✅ ACID compliant |
| **Rollback automatico** | ❌ Manuale | ✅ Automatico |
| **Gestione errori** | Complessa (cleanup manuale) | Semplice (rollback DB) |

---

## Testing

### Test 1: Inserimento Normale
```javascript
// In AITrainingInput.jsx, inserisci:
"Test 150m in 19.5s"
```
**Verifica:** Sessione salvata correttamente con tutti i set.

### Test 2: Simulazione Errore
```javascript
// In trainingService.js, aggiungi prima della chiamata RPC:
throw new Error('Test rollback');
```
**Verifica:** Nulla salvato nel database (rollback automatico).

### Test 3: Multi-Gruppo
```javascript
// Inserisci:
"Riscaldamento 2km + 6x100m rec 3min + defaticamento 1km"
```
**Verifica:** 3 gruppi salvati in 1 transazione.

---

## Limiti Attuali (Da Implementare Futuro)

⚠️ **PB Non Ricalcolati su Modifica:**
- Se modifichi una sessione esistente (es. correggi un tempo da 10.5s a 10.6s), il PB in `race_records` non si aggiorna automaticamente.
- **Soluzione futura:** Trigger SQL `AFTER UPDATE ON training_sessions` che ricalcola i PB.

⚠️ **Delete Non Ottimizzato:**
- La cancellazione usa ancora `DELETE FROM training_sessions` senza RPC.
- **Soluzione futura:** RPC `delete_full_training_session` con cascade personalizzato.

---

## Troubleshooting

### Errore: "function insert_full_training_session does not exist"
**Causa:** Stored procedure non creata in Supabase.
**Soluzione:** Esegui `supabase-rpc-insert-session.sql` nel SQL Editor.

### Errore: "column p_groups does not exist"
**Causa:** Typo nel nome parametro o versione vecchia della funzione.
**Soluzione:** 
1. Cancella la funzione vecchia: `DROP FUNCTION insert_full_training_session;`
2. Ricrea con il file SQL aggiornato.

### Errore: "permission denied for function insert_full_training_session"
**Causa:** RLS policy non configurata.
**Soluzione:** Esegui in SQL Editor:
```sql
GRANT EXECUTE ON FUNCTION insert_full_training_session TO authenticated;
GRANT EXECUTE ON FUNCTION insert_full_training_session TO anon;
```

---

## Prossimi Passi

1. ✅ RPC insert session implementata
2. 🔄 Monitorare performance nei prossimi 7 giorni
3. 📊 Implementare RPC per update/delete session
4. 🎯 Aggiungere trigger SQL per PB auto-update

---

**Documentazione creata:** 2026-01-19  
**Versione:** 1.0  
**Status:** ✅ Produzione
