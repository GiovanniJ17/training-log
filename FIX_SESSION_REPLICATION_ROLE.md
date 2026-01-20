# ✅ FIX: Risoluzione Session Replication Role Error

## 🔴 Il Problema
**Errore:** `column "session_replication_role" does not exist (codice 42703)`

L'errore indicava che Postgres stava interpretando `session_replication_role` come una colonna della tabella, invece che come una impostazione di configurazione di sistema.

### Causa Root
La funzione RPC `insert_full_training_session` non era implementata nel database. Quando il frontend tentava di chiamarla, Supabase non riusciva a eseguirla, causando il fallback al metodo diretto che però aveva problemi con il trigger del personal best.

---

## ✅ La Soluzione

### 1. **Creata la funzione `insert_full_training_session`** in `db-schema.sql`

La funzione è implementata correttamente con:

- **`SECURITY DEFINER`**: Permette alla funzione di avere i permessi necessari per usare le impostazioni di sessione
- **`SET LOCAL session_replication_role = 'replica'`**: Disabilita i trigger **solo per questa transazione**, evitando il loop infinito nel trigger `check_and_mark_personal_best`
- **Inserimento atomico**: Sessione → Gruppi → Sets in una singola transazione

#### Sintassi Corretta
```sql
CREATE OR REPLACE FUNCTION public.insert_full_training_session(...)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- ✅ CORRETTO: SET LOCAL all'inizio della funzione
  SET LOCAL session_replication_role = 'replica';
  
  -- Logica di inserimento...
  RETURN v_session_id;
END;
$$;
```

#### Come Funziona
1. **`SET LOCAL`** = La modifica vale SOLO per questa transazione
2. **`session_replication_role = 'replica'`** = Disabilita i trigger
3. Al termine della funzione, `session_replication_role` torna automaticamente a `'origin'`
4. Nessuno stack depth error! ✨

### 2. **Validazione del Payload**

Il file `src/services/trainingService.js` invia un payload pulito:

```javascript
const { data: sessionId, error } = await supabase.rpc('insert_full_training_session', {
  p_date: standardizedData.session.date,
  p_title: standardizedData.session.title,
  p_type: standardizedData.session.type,
  p_location: standardizedData.session.location || null,
  p_rpe: standardizedData.session.rpe || null,
  p_feeling: standardizedData.session.feeling || null,
  p_notes: standardizedData.session.notes || null,
  p_groups: groupsJson  // ✅ Pulito, nessun campo spurio
});
```

✅ **NESSUN campo `session_replication_role` nel payload**

---

## 📋 File Modificati

### `db-schema.sql`
- ✅ Aggiunta funzione `insert_full_training_session` con `SECURITY DEFINER`
- ✅ Usa `SET LOCAL session_replication_role = 'replica'` all'inizio
- ✅ Logica di inserimento atomico per sessioni, gruppi e sets
- ✅ Grant di esecuzione per `authenticated`, `anon`, `service_role`

### `test-insert-function.sql` (Nuovo)
- Script di test per validare che la funzione funzioni senza stack depth errors
- Test 1: Inserimento semplice
- Test 2: Verifica trigger PB senza loop infinito

---

## 🚀 Cosa Fare Adesso

### Step 1: Applicare il db-schema.sql al database
```bash
# Opzione A: Su Supabase via SQL Editor
# 1. Apri https://app.supabase.com/project/YOUR_PROJECT/sql
# 2. Copia il contenuto di db-schema.sql
# 3. Esegui

# Opzione B: Via psql (se hai accesso diretto)
psql -h YOUR_HOST -U postgres -d training_log -f db-schema.sql
```

### Step 2: Testare la funzione
```bash
# Su Supabase SQL Editor, esegui test-insert-function.sql
```

### Step 3: Verificare che il frontend funzioni
Il frontend dovrebbe ora essere in grado di inserire sessioni di allenamento senza errori.

---

## 🔍 Spiegazione Tecnica Dettagliata

### Perché `SET LOCAL` è la soluzione corretta?

```sql
-- ❌ SBAGLIATO: Effetto globale (non si può fare in RPC)
SET session_replication_role = 'replica';

-- ✅ CORRETTO: Effetto locale a questa transazione
SET LOCAL session_replication_role = 'replica';
```

Con `SET LOCAL`:
- Solo questa funzione vede `session_replication_role = 'replica'`
- Il trigger del personal best lo vede e non si attiva
- Nessun UPDATE interno ri-triggera se stesso
- Al termine della funzione, tutto torna a `'origin'`

### Perché `SECURITY DEFINER`?

Il database user `authenticated` non ha i permessi per cambiare `session_replication_role`. Con `SECURITY DEFINER`, la funzione si esegue con i permessi del creatore (solitamente `postgres` o `service_role`), che ha tutti i permessi.

---

## 📊 Flow Completo

```
Frontend (trainingService.js)
    ↓
    [Chiama RPC: insert_full_training_session]
    ↓
DB Function (SECURITY DEFINER)
    ↓
    [SET LOCAL session_replication_role = 'replica']
    ↓
    [INSERT training_sessions] → session_id
    ↓
    [INSERT workout_groups] con session_id
    ↓
    [INSERT workout_sets] con group_id
    ↓
    [Trigger check_and_mark_personal_best disabilitato ✅]
    ↓
    [RETURN session_id]
    ↓
    [session_replication_role torna a 'origin' automaticamente]
    ↓
Frontend
    [Riceve session_id, nessun errore!]
```

---

## ✨ Benefici Finali

1. ✅ **Nessuno stack depth error** - Il trigger non genera loop infinito
2. ✅ **Inserimento atomico** - O tutto o niente (ACID compliance)
3. ✅ **Una sola query di rete** - Migliore performance (vs 3+ query)
4. ✅ **Robusto** - Se la connessione cade, il database fa rollback automatico
5. ✅ **Sicuro** - `SECURITY DEFINER` garantisce i permessi necessari

---

## 🧪 Testing

Per testare manualmente in Supabase:

```sql
-- Test rapido
SELECT public.insert_full_training_session(
  CURRENT_DATE,
  'Test Session',
  'pista',
  'Test Location',
  7,
  'Good',
  'Test notes',
  jsonb_build_array(
    jsonb_build_object(
      'order_index', 1,
      'name', 'Warm-up',
      'notes', 'Warm-up group',
      'sets', jsonb_build_array(
        jsonb_build_object(
          'exercise_name', '100m sprint',
          'category', 'sprint',
          'sets', 1,
          'reps', 1,
          'distance_m', 100,
          'time_s', 11.5,
          'recovery_s', 120,
          'notes', 'Test sprint'
        )
      )
    )
  )
) AS session_id;
```

Se la query ritorna un UUID valido senza errori, la funzione funziona perfettamente! ✅
