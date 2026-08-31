import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend
} from "recharts";
import { Plus, X, RefreshCw, ChevronLeft, ChevronRight, Users, Settings, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { fbGet, fbSet, fbGetStatus } from "./firebase.js";

// ---------- theme ----------
const T = {
  paper: "#F7F2E7",
  paper2: "#FDFAF3",
  ink: "#23302B",
  muted: "#7A6F5C",
  teal: "#1E6B5C",
  tealDark: "#134A3F",
  gold: "#C7841F",
  red: "#B23A2E",
  border: "#D8D0BC",
};

// ---------- static data ----------
const DEFAULT_MEMBERS = [
  { id: "rajesh", name: "Rajesh", dob: "1968-03-03", emoji: "👨" },
  { id: "sharda", name: "Sharda", dob: "1970-03-19", emoji: "👩" },
  { id: "meet", name: "Meet", dob: "1996-01-09", emoji: "🧑" },
  { id: "aishwarya", name: "Aishwarya", dob: "1997-12-22", emoji: "👩‍🦱" },
  { id: "aarav", name: "Aarav", dob: "2025-08-01", emoji: "👶" },
  { id: "daadi", name: "Daadi", dob: null, approxAge: 93, emoji: "👵" },
];
const HOUSEHOLD_EMOJI = "🏠";
const PIE_COLORS = [T.teal, T.gold, "#7F9E6B", "#A2673A", "#8A6FB0", "#4E8FA6", T.red];

const DEFAULT_CATEGORIES = [
  { id: "maintenance", name: "Society maintenance", scope: "household", recurring: true, defaultAmount: 8400 },
  { id: "electricity", name: "Electricity", scope: "household", recurring: true, defaultAmount: 3000 },
  { id: "emi", name: "Home loan EMI", scope: "household", recurring: true, defaultAmount: 0 },
  { id: "groceries", name: "Monthly groceries", scope: "household", recurring: true, defaultAmount: 14000 },
  { id: "chef_afternoon", name: "Home chef — afternoon", scope: "household", recurring: true, defaultAmount: 6000 },
  { id: "chef_night", name: "Home chef — night", scope: "household", recurring: true, defaultAmount: 6500 },
  { id: "caretaker", name: "Daadi's care taker", scope: "household", recurring: true, defaultAmount: 18000 },
  { id: "help1", name: "Fixed house help 1", scope: "household", recurring: true, defaultAmount: 4000 },
  { id: "help2", name: "Fixed house help 2", scope: "household", recurring: true, defaultAmount: 4000 },
  { id: "apphelp", name: "App-based help bookings", scope: "household", recurring: false },
  { id: "diapers", name: "Diapers and infant needs", scope: "household", recurring: false },
  { id: "quickcommerce", name: "Quick commerce orders", scope: "household", recurring: false },
  { id: "misc", name: "Miscellaneous", scope: "both", recurring: false },
  { id: "personal", name: "Personal shopping", scope: "personal", recurring: false },
  { id: "mobile_internet", name: "Mobile and internet bills", scope: "household", recurring: true, defaultAmount: 1500 },
  { id: "insurance", name: "Insurance premiums", scope: "household", recurring: false },
  { id: "medical", name: "Medical and medicines", scope: "both", recurring: false },
  { id: "transport", name: "Transport and fuel", scope: "personal", recurring: false },
  { id: "dining_out", name: "Dining out", scope: "personal", recurring: false },
  { id: "subscriptions", name: "Subscriptions (OTT, gym, etc.)", scope: "personal", recurring: true, defaultAmount: 500 },
  { id: "festivals_gifts", name: "Festivals and gifts", scope: "household", recurring: false },
  { id: "personal_care", name: "Personal care and grooming", scope: "personal", recurring: false },
];

// ---------- helpers ----------
const pad = (n) => String(n).padStart(2, "0");
const monthKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const shiftMonthKey = (mk, delta) => {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyOf(d);
};
const monthLabel = (mk) => {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};
const fmtINR = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function calcAge(dob, approxAge) {
  if (!dob) return approxAge ? `~${approxAge} yrs` : "—";
  const b = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years < 2) return `${years * 12 + months} mo`;
  return `${years} yrs`;
}

async function storageGetJSON(key, fallback) {
  return fbGet(key, fallback);
}
async function storageSetJSON(key, value) {
  await fbSet(key, value);
}

async function markMonthSeeded(mk) {
  const seeded = await storageGetJSON("seeded_months", []);
  if (!seeded.includes(mk)) await storageSetJSON("seeded_months", [...seeded, mk]);
}

function seedRecurringForMonth(prevExpenses, categories, monthKey) {
  const dateStr = `${monthKey}-01`;
  const prevByKey = {};
  (prevExpenses || []).forEach((e) => {
    if (e.recurring) prevByKey[`${e.scope}|${e.categoryId}`] = e;
  });
  const seeded = [];
  categories
    .filter((c) => c.recurring && c.scope === "household")
    .forEach((c) => {
      const k = `household|${c.id}`;
      const prev = prevByKey[k];
      seeded.push({
        id: uid(),
        categoryId: c.id,
        scope: "household",
        amount: prev ? prev.amount : c.defaultAmount || 0,
        note: prev ? prev.note || "" : "",
        date: dateStr,
        recurring: true,
        auto: true,
      });
      delete prevByKey[k];
    });
  Object.values(prevByKey).forEach((e) => {
    seeded.push({ ...e, id: uid(), date: dateStr, auto: true });
  });
  return seeded;
}

// ---------- main component ----------
export default function HouseholdLedger() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState(DEFAULT_MEMBERS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [expensesCache, setExpensesCache] = useState({}); // { monthKey: [...] }
  const [monthKey, setMonthKey] = useState(monthKeyOf(new Date()));
  const [scope, setScope] = useState("household"); // 'household' | memberId
  const [showAdd, setShowAdd] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showFamily, setShowFamily] = useState(false);
  const [trend, setTrend] = useState([]); // last 6 months totals

  const loadMonth = useCallback(async (mk, catsOverride) => {
    const cats = catsOverride || categories;
    const res = await fbGetStatus(`expenses:${mk}`);
    let data;
    if (res.status === "ok") {
      data = res.value;
    } else if (res.status === "missing") {
      // Firestore confirmed this document genuinely doesn't exist — safe to seed.
      const prevMk = shiftMonthKey(mk, -1);
      const prevData = await storageGetJSON(`expenses:${prevMk}`, []);
      data = seedRecurringForMonth(prevData, cats, mk);
      await storageSetJSON(`expenses:${mk}`, data);
      await markMonthSeeded(mk);
    } else {
      // Fetch failed (network/permissions) — never overwrite; show empty locally only.
      data = [];
    }
    setExpensesCache((c) => ({ ...c, [mk]: data }));
    return data;
  }, [categories]);

  useEffect(() => {
    (async () => {
      const storedMembers = await storageGetJSON("members", null);
      let finalMembers = storedMembers || DEFAULT_MEMBERS;
      if (storedMembers) {
        finalMembers = storedMembers.map((sm) => {
          const def = DEFAULT_MEMBERS.find((d) => d.id === sm.id);
          return { ...sm, emoji: sm.emoji || def?.emoji || "🙂" };
        });
        if (JSON.stringify(finalMembers) !== JSON.stringify(storedMembers)) {
          await storageSetJSON("members", finalMembers);
        }
      } else {
        await storageSetJSON("members", finalMembers);
      }

      const storedCats = await storageGetJSON("categories", null);
      let finalCats = storedCats || DEFAULT_CATEGORIES;
      if (storedCats) {
        const existingIds = new Set(storedCats.map((c) => c.id));
        const missing = DEFAULT_CATEGORIES.filter((c) => !existingIds.has(c.id));
        if (missing.length) {
          finalCats = [...storedCats, ...missing];
          await storageSetJSON("categories", finalCats);
        }
      } else {
        await storageSetJSON("categories", finalCats);
      }
      setMembers(finalMembers);
      setCategories(finalCats);

      const cur = monthKeyOf(new Date());
      const prev = shiftMonthKey(cur, -1);
      await loadMonth(cur, finalCats);
      const prevData = await storageGetJSON(`expenses:${prev}`, []);
      setExpensesCache((c2) => ({ ...c2, [prev]: prevData }));

      // 6-month trend
      const points = [];
      for (let i = 5; i >= 0; i--) {
        const mk = shiftMonthKey(cur, -i);
        const arr = mk === cur ? undefined : await storageGetJSON(`expenses:${mk}`, []);
        const list = mk === cur ? (await storageGetJSON(`expenses:${cur}`, [])) : arr;
        const total = (list || []).filter((e) => e.scope === "household" || members.some(mm=>mm.id===e.scope)).reduce((s, e) => s + Number(e.amount || 0), 0);
        points.push({ month: monthLabel(mk).split(" ")[0].slice(0, 3), total });
      }
      setTrend(points);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!expensesCache[monthKey] && !loading) loadMonth(monthKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  const currentExpenses = expensesCache[monthKey] || [];
  const prevMonthKey = shiftMonthKey(monthKey, -1);
  const prevExpenses = expensesCache[prevMonthKey] || [];

  const scopedExpenses = useMemo(
    () => currentExpenses.filter((e) => e.scope === scope),
    [currentExpenses, scope]
  );
  const householdTotal = useMemo(
    () => currentExpenses.filter((e) => e.scope === "household").reduce((s, e) => s + Number(e.amount || 0), 0),
    [currentExpenses]
  );
  const prevHouseholdTotal = useMemo(
    () => prevExpenses.filter((e) => e.scope === "household").reduce((s, e) => s + Number(e.amount || 0), 0),
    [prevExpenses]
  );
  const delta = householdTotal - prevHouseholdTotal;
  const deltaPct = prevHouseholdTotal ? Math.round((delta / prevHouseholdTotal) * 100) : 0;

  const scopeBreakdown = useMemo(() => {
    const map = { household: 0 };
    members.forEach((m) => (map[m.id] = 0));
    currentExpenses.forEach((e) => {
      if (map[e.scope] === undefined) map[e.scope] = 0;
      map[e.scope] += Number(e.amount || 0);
    });
    return Object.entries(map)
      .map(([id, amount]) => {
        if (id === "household") return { name: `${HOUSEHOLD_EMOJI} Household`, amount };
        const m = members.find((mm) => mm.id === id);
        return { name: `${m?.emoji || ""} ${m?.name || id}`, amount };
      })
      .filter((d) => d.amount > 0);
  }, [currentExpenses, members]);

  const categoryBreakdown = useMemo(() => {
    const map = {};
    scopedExpenses.forEach((e) => {
      const cat = categories.find((c) => c.id === e.categoryId);
      const name = e.customCategoryName || cat?.name || "Other";
      map[name] = (map[name] || 0) + Number(e.amount || 0);
    });
    return Object.entries(map).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }, [scopedExpenses, categories]);

  const saveExpenses = async (mk, list) => {
    setExpensesCache((c) => ({ ...c, [mk]: list }));
    await storageSetJSON(`expenses:${mk}`, list);
    await markMonthSeeded(mk);
  };

  const addExpense = async (entry) => {
    const list = [...(expensesCache[monthKey] || []), { ...entry, id: uid() }];
    await saveExpenses(monthKey, list);
    setShowAdd(false);
  };

  const updateExpense = async (id, patch) => {
    const list = (expensesCache[monthKey] || []).map((e) => (e.id === id ? { ...e, ...patch } : e));
    await saveExpenses(monthKey, list);
  };

  const deleteExpense = async (id) => {
    const list = (expensesCache[monthKey] || []).filter((e) => e.id !== id);
    await saveExpenses(monthKey, list);
  };

  const addCategory = async (name, catScope) => {
    const newCat = { id: uid(), name, scope: catScope, recurring: false, defaultAmount: 0 };
    const next = [...categories, newCat];
    setCategories(next);
    await storageSetJSON("categories", next);
    return newCat.id;
  };

  // ---------- insights ----------
  const insights = useMemo(() => {
    const out = [];
    const emiCat = categories.find((c) => c.id === "emi");
    const emiEntry = currentExpenses.find((e) => e.categoryId === "emi");
    if (emiEntry && Number(emiEntry.amount) === 0) {
      out.push({ tone: "alert", text: "Home loan EMI is set to ₹0 — tap it in the ledger to enter the real amount." });
    }
    if (prevHouseholdTotal > 0) {
      out.push({
        tone: delta > 0 ? "alert" : "good",
        text: `Household spend is ${delta >= 0 ? "up" : "down"} ${Math.abs(deltaPct)}% vs ${monthLabel(prevMonthKey)} (${fmtINR(Math.abs(delta))}).`,
      });
    }
    const appHelp = currentExpenses.filter((e) => e.categoryId === "apphelp").reduce((s, e) => s + Number(e.amount || 0), 0);
    const fixedHelp = currentExpenses.filter((e) => ["help1", "help2"].includes(e.categoryId)).reduce((s, e) => s + Number(e.amount || 0), 0);
    if (appHelp > 0 && fixedHelp > 0 && appHelp > fixedHelp * 0.4) {
      out.push({ tone: "alert", text: `App-based help bookings cost ${fmtINR(appHelp)} this month — that's close to what a third fixed help would cost. Worth comparing.` });
    }
    const grocThis = currentExpenses.filter((e) => e.categoryId === "groceries").reduce((s, e) => s + Number(e.amount || 0), 0);
    const grocPrev = prevExpenses.filter((e) => e.categoryId === "groceries").reduce((s, e) => s + Number(e.amount || 0), 0);
    if (grocPrev > 0 && grocThis > grocPrev * 1.2) {
      out.push({ tone: "alert", text: `Groceries are ${Math.round(((grocThis - grocPrev) / grocPrev) * 100)}% higher than last month.` });
    }
    if (out.length === 0) out.push({ tone: "good", text: "✨ Spending looks steady month over month. No flags right now." });
    return out;
  }, [currentExpenses, prevExpenses, prevHouseholdTotal, delta, deltaPct, categories, prevMonthKey]);

  if (loading) {
    return (
      <div style={{ background: T.paper, borderRadius: 16, padding: "3rem", textAlign: "center", fontFamily: "'Fraunces', serif", color: T.muted }}>
        Opening the ledger…
      </div>
    );
  }

  return (
    <div style={{ background: T.paper, borderRadius: 16, padding: "1.5rem", fontFamily: "'Public Sans', -apple-system, sans-serif", color: T.ink, maxWidth: 720, margin: "0 auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600&family=Public+Sans:wght@400;500;600&display=swap');
        .fr { font-family: 'Fraunces', serif; font-variant-numeric: tabular-nums; }
        .rowhover:hover { background: ${T.paper2}; }
        button.hl-btn { cursor: pointer; border: none; font-family: 'Public Sans', sans-serif; }
      `}</style>

      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div className="fr" style={{ fontSize: 22, fontWeight: 600, color: T.tealDark }}>💰 Gori's Griha Khata</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>the family's money diary</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="hl-btn" onClick={() => setShowFamily(true)} style={{ background: "transparent", border: `0.5px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.ink }}>
            <Users size={15} /> Family
          </button>
          <button className="hl-btn" onClick={() => setShowManage(true)} style={{ background: "transparent", border: `0.5px solid ${T.border}`, borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.ink }}>
            <Settings size={15} /> Categories
          </button>
        </div>
      </div>

      {/* month nav + totals */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.muted, marginBottom: 2 }}>
            <button className="hl-btn" onClick={() => setMonthKey(shiftMonthKey(monthKey, -1))} style={{ background: "none", padding: 2, display: "flex" }}>
              <ChevronLeft size={14} color={T.muted} />
            </button>
            {monthLabel(monthKey)}
            <button className="hl-btn" onClick={() => setMonthKey(shiftMonthKey(monthKey, 1))} style={{ background: "none", padding: 2, display: "flex" }}>
              <ChevronRight size={14} color={T.muted} />
            </button>
          </div>
          <div className="fr" style={{ fontSize: 30, fontWeight: 600 }}>{fmtINR(householdTotal)}</div>
        </div>
        {prevHouseholdTotal > 0 && (
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: T.muted }}>vs {monthLabel(prevMonthKey).split(" ")[0]}</div>
            <div className="fr" style={{ fontSize: 16, fontWeight: 500, color: delta >= 0 ? T.red : T.teal, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
              {delta >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />} {fmtINR(Math.abs(delta))}
            </div>
          </div>
        )}
      </div>

      {/* member tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Tab active={scope === "household"} onClick={() => setScope("household")} label={`${HOUSEHOLD_EMOJI} Household`} />
        {members.map((m) => (
          <Tab key={m.id} active={scope === m.id} onClick={() => setScope(m.id)} label={`${m.emoji || ""} ${m.name}`} />
        ))}
      </div>

      {/* add button */}
      <button
        className="hl-btn"
        onClick={() => setShowAdd(true)}
        style={{ background: T.teal, color: T.paper, borderRadius: 8, padding: "9px 16px", display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 500, marginBottom: 16 }}
      >
        <Plus size={16} /> Add expense
      </button>

      {/* ledger list */}
      <div style={{ borderLeft: `2px solid ${T.red}`, paddingLeft: 14, marginBottom: 20 }}>
        {scopedExpenses.length === 0 && (
          <div style={{ color: T.muted, fontSize: 14, padding: "12px 0" }}>No entries yet for {scope === "household" ? "the household" : members.find(m=>m.id===scope)?.name} this month.</div>
        )}
        {scopedExpenses.map((e) => {
          const cat = categories.find((c) => c.id === e.categoryId);
          return (
            <LedgerRow
              key={e.id}
              label={e.customCategoryName || cat?.name || "Other"}
              recurring={e.recurring}
              amount={e.amount}
              onSave={(amt) => updateExpense(e.id, { amount: amt })}
              onDelete={() => deleteExpense(e.id)}
            />
          );
        })}
      </div>

      {/* charts */}
      {scopeBreakdown.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>🥧 who's spending what, this month</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={scopeBreakdown} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {scopeBreakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ fontFamily: "'Public Sans', sans-serif", fontSize: 12, border: `0.5px solid ${T.border}` }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {categoryBreakdown.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>📊 breakdown by category</div>
          <ResponsiveContainer width="100%" height={Math.max(120, categoryBreakdown.length * 32)}>
            <BarChart data={categoryBreakdown} layout="vertical" margin={{ left: 8, right: 24 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: T.ink }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ fontFamily: "'Public Sans', sans-serif", fontSize: 12, border: `0.5px solid ${T.border}` }} />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]} fill={T.teal}>
                {categoryBreakdown.map((_, i) => <Cell key={i} fill={i === 0 ? T.gold : T.teal} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>📈 the last 6 months</div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={trend} margin={{ left: -20, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: T.muted }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: T.muted }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => `₹${Math.round(v/1000)}k`} />
            <Tooltip formatter={(v) => fmtINR(v)} contentStyle={{ fontFamily: "'Public Sans', sans-serif", fontSize: 12, border: `0.5px solid ${T.border}` }} />
            <Line type="monotone" dataKey="total" stroke={T.tealDark} strokeWidth={2} dot={{ r: 3, fill: T.tealDark }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* insights */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {insights.map((n, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", background: "#EFE6D0", borderRadius: 8 }}>
            <AlertCircle size={15} color={n.tone === "alert" ? T.red : T.teal} style={{ marginTop: 2, flexShrink: 0 }} />
            <div className="fr" style={{ fontSize: 13, fontStyle: "italic", color: "#4A4130" }}>{n.text}</div>
          </div>
        ))}
      </div>

      {showAdd && (
        <AddExpenseModal
          members={members}
          categories={categories}
          onClose={() => setShowAdd(false)}
          onAdd={addExpense}
          onAddCategory={addCategory}
          defaultScope={scope}
        />
      )}
      {showManage && (
        <ManageCategoriesModal
          categories={categories}
          onClose={() => setShowManage(false)}
          onAddCategory={addCategory}
        />
      )}
      {showFamily && <FamilyModal members={members} onClose={() => setShowFamily(false)} />}
    </div>
  );
}

// ---------- subcomponents ----------
function Tab({ active, onClick, label }) {
  return (
    <button
      className="hl-btn"
      onClick={onClick}
      style={{
        background: active ? T.teal : "transparent",
        color: active ? T.paper : T.ink,
        border: active ? "none" : `0.5px solid ${T.muted}`,
        borderRadius: 20,
        padding: "6px 14px",
        fontSize: 13,
      }}
    >
      {label}
    </button>
  );
}

function LedgerRow({ label, amount, recurring, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(amount);
  useEffect(() => setVal(amount), [amount]);
  return (
    <div className="rowhover" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 4px", borderBottom: `0.5px solid ${T.border}` }}>
      <div style={{ fontSize: 14 }}>
        {label}
        {recurring && <RefreshCw size={11} color={T.gold} style={{ marginLeft: 6, verticalAlign: -1 }} />}
      </div>
      {editing ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="number"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            style={{ width: 90, fontSize: 13, padding: "3px 6px" }}
            autoFocus
          />
          <button className="hl-btn" onClick={() => { onSave(Number(val)); setEditing(false); }} style={{ background: T.teal, color: T.paper, borderRadius: 6, padding: "3px 8px", fontSize: 12 }}>Save</button>
          <button className="hl-btn" onClick={onDelete} style={{ background: "none", color: T.red, fontSize: 12 }}>Delete</button>
        </div>
      ) : (
        <div className="fr" style={{ fontSize: 15, cursor: "pointer" }} onClick={() => setEditing(true)}>{fmtINR(amount)}</div>
      )}
    </div>
  );
}

function AddExpenseModal({ members, categories, onClose, onAdd, onAddCategory, defaultScope }) {
  const [scope, setScope] = useState(defaultScope || "household");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [customName, setCustomName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [newCatMode, setNewCatMode] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [error, setError] = useState("");

  const scopeIsMember = scope !== "household";
  const visibleCats = categories.filter((c) => c.scope === "household" || c.scope === "both" || (scopeIsMember && (c.scope === "personal" || c.scope === "both")));

  const submit = async () => {
    if (!amount || Number(amount) <= 0) { setError("Enter an amount first"); return; }
    let catId = categoryId;
    if (newCatMode) {
      if (!newCatName.trim()) { setError("Enter a category name"); return; }
      catId = await onAddCategory(newCatName.trim(), scopeIsMember ? "personal" : "household");
    }
    onAdd({
      categoryId: catId,
      scope,
      amount: Number(amount),
      note,
      date: new Date().toISOString().slice(0, 10),
      recurring,
    });
  };

  return (
    <ModalShell onClose={onClose} title="Add expense">
      <Field label="Who's this for">
        <select value={scope} onChange={(e) => setScope(e.target.value)} style={selectStyle}>
          <option value="household">🏠 Household</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
        </select>
      </Field>
      <Field label="Category">
        {!newCatMode ? (
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={selectStyle}>
            {visibleCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : (
          <input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="New category name" style={inputStyle} />
        )}
        <button className="hl-btn" onClick={() => setNewCatMode((v) => !v)} style={{ background: "none", color: T.teal, fontSize: 12, marginTop: 4, textDecoration: "underline" }}>
          {newCatMode ? "Choose existing category" : "+ Add new category"}
        </button>
      </Field>
      <Field label="Amount">
        <input type="number" value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} placeholder="0" style={inputStyle} />
      </Field>
      <Field label="Note (optional)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Zomato instamart order" style={inputStyle} />
      </Field>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 16 }}>
        <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
        Repeats every month (auto-fills next month, editable)
      </label>
      {error && <div style={{ color: T.red, fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <button className="hl-btn" onClick={submit} style={{ background: T.teal, color: T.paper, borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 500, width: "100%" }}>
        Save entry
      </button>
    </ModalShell>
  );
}

function ManageCategoriesModal({ categories, onClose, onAddCategory }) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState("household");
  const [error, setError] = useState("");
  const add = async () => {
    if (!name.trim()) { setError("Enter a category name"); return; }
    await onAddCategory(name.trim(), scope);
    setName("");
  };
  return (
    <ModalShell onClose={onClose} title="Categories">
      <div style={{ maxHeight: 240, overflowY: "auto", marginBottom: 16, border: `0.5px solid ${T.border}`, borderRadius: 8 }}>
        {categories.map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: `0.5px solid ${T.border}`, fontSize: 13 }}>
            <span>{c.name}</span>
            <span style={{ color: T.muted }}>{c.scope}{c.recurring ? " · recurring" : ""}</span>
          </div>
        ))}
      </div>
      <Field label="New category name">
        <input value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="e.g. Kids' school fees" style={inputStyle} />
      </Field>
      <Field label="Applies to">
        <select value={scope} onChange={(e) => setScope(e.target.value)} style={selectStyle}>
          <option value="household">Household</option>
          <option value="personal">Personal (any member)</option>
          <option value="both">Both</option>
        </select>
      </Field>
      {error && <div style={{ color: T.red, fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <button className="hl-btn" onClick={add} style={{ background: T.teal, color: T.paper, borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 500, width: "100%" }}>
        Add category
      </button>
    </ModalShell>
  );
}

function FamilyModal({ members, onClose }) {
  return (
    <ModalShell onClose={onClose} title="Family">
      {members.map((m) => (
        <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 4px", borderBottom: `0.5px solid ${T.border}` }}>
          <div style={{ fontSize: 14 }}>{m.emoji} {m.name}</div>
          <div style={{ fontSize: 13, color: T.muted }}>{calcAge(m.dob, m.approxAge)}</div>
        </div>
      ))}
    </ModalShell>
  );
}

function ModalShell({ onClose, title, children }) {
  return (
    <div style={{ position: "static", marginTop: 20, background: T.paper2, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div className="fr" style={{ fontSize: 17, fontWeight: 600 }}>{title}</div>
        <button className="hl-btn" onClick={onClose} style={{ background: "none", padding: 4, display: "flex" }}>
          <X size={18} color={T.muted} />
        </button>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = { width: "100%", fontSize: 14, padding: "8px 10px", border: `0.5px solid ${T.border}`, borderRadius: 8, background: "#fff", boxSizing: "border-box" };
const selectStyle = { ...inputStyle };
