import fs from "fs";

let code = fs.readFileSync("worker.js", "utf-8");

const oldCatch1 = `        } catch (e) {
          results.push({ row_id: rowId, ok: false, error: String(e?.message || e) });
        }
      }
    } catch (e) {
      results.push({ row_id: rowId, ok: false, error: String(e?.message || e) });
    }
  }`;

const newCatch1 = `        } catch (e) {
          results.push({ row_id: rowId, ok: false, error: String(e?.message || e) });
          await auditFailure(env, { user: who, client: slug, account_id: accountId, adset_id: adsetId, row_id: rowId, error: String(e?.message || e) });
        }
      }
    } catch (e) {
      results.push({ row_id: rowId, ok: false, error: String(e?.message || e) });
      await auditFailure(env, { user: who, client: slug, account_id: accountId, adset_id: targetAdset, row_id: rowId, error: String(e?.message || e) });
    }
  }`;

code = code.replace(oldCatch1, newCatch1);
fs.writeFileSync("worker.js", code);
console.log("Patched worker.js to audit catch failures");
