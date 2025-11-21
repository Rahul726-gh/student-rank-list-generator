// Fixed and improved script.js for Student Rank List Generator
// Key changes:
// - Each student now has a unique `id` (Date.now()) to avoid index-based bugs when filtering.
// - Robust validation for inputs (required fields, marks 0-100, enroll length <= 10, no duplicates).
// - Edit mode (save changes) implemented instead of deleting-then-adding.
// - Search renders filtered rows but edit/delete act on the original students via id.
// - Ranking algorithms kept; quick sort returns a new array as before.
// - Stats, topper, and total students are calculated from the main `students` array.
// - CSV export includes a UTF-8 BOM so Excel opens it cleanly.

let students = JSON.parse(localStorage.getItem("students")) || [];
// backfill old entries that might not have an id
students = students.map(s => s.id ? s : { ...s, id: Date.now() + Math.floor(Math.random()*10000) });

let editingId = null;

const tbody = document.querySelector("#rankTable tbody");
const totalStudentsEl = document.getElementById("totalStudents");
const topperNameEl = document.getElementById("topperName");
const averageMarksEl = document.getElementById("averageMarks");
const addBtn = document.getElementById("addBtn");

document.getElementById("addBtn").addEventListener("click", addOrSaveStudent);
document.getElementById("rankBtn").addEventListener("click", generateRankList);
document.getElementById("themeToggle").addEventListener("click", toggleTheme);
document.getElementById("exportBtn").addEventListener("click", exportCSV);
document.getElementById("searchInput").addEventListener("input", searchStudents);

function addOrSaveStudent() {
  const name = document.getElementById("name").value.trim();
  const enroll = document.getElementById("enroll").value.trim();
  const mathRaw = document.getElementById("math").value;
  const scienceRaw = document.getElementById("science").value;
  const englishRaw = document.getElementById("english").value;

  // Validate presence
  if (!name || !enroll || mathRaw === "" || scienceRaw === "" || englishRaw === "") {
    alert("Please fill all fields!");
    return;
  }

  const math = Number(mathRaw);
  const science = Number(scienceRaw);
  const english = Number(englishRaw);

  // Validate numbers
  if ([math, science, english].some(v => Number.isNaN(v))) {
    alert("Marks must be valid numbers.");
    return;
  }

  // Validate ranges
  if ([math, science, english].some(v => v < 0 || v > 100)) {
    alert("Marks must be between 0 and 100.");
    return;
  }

  // Enrollment length limit
  if (enroll.length > 10) {
    alert("Enrollment number must be at most 10 characters.");
    return;
  }

  // Duplicate enroll check (ignore current editing student)
  const dup = students.find(s => s.enroll === enroll && s.id !== editingId);
  if (dup) {
    alert("A student with this enrollment already exists.");
    return;
  }

  if (editingId) {
    // Save edited student
    const idx = students.findIndex(s => s.id === editingId);
    if (idx >= 0) {
      students[idx] = { ...students[idx], name, enroll, math, science, english };
      editingId = null;
      addBtn.textContent = "➕ Add Student";
    }
  } else {
    // Add new student
    const id = Date.now() + Math.floor(Math.random() * 10000);
    students.push({ id, name, enroll, math, science, english });
  }

  saveData();
  clearInputs();
  renderTable(students);
}

function clearInputs() {
  document.querySelectorAll("input").forEach(i => i.value = "");
  editingId = null;
  addBtn.textContent = "➕ Add Student";
}

function generateRankList() {
  const sortBy = document.getElementById("sortBy").value;
  const algo = document.getElementById("sortAlgo").value;

  const compare = (a, b) => {
    // For name and enroll we want ascending alphabetical
    if (sortBy === "name" || sortBy === "enroll")
      return a[sortBy].toString().localeCompare(b[sortBy].toString());

    // For total we want descending (highest total first)
    if (sortBy === "total")
      return getTotal(b) - getTotal(a);

    // For numeric subject fields, sort descending
    return b[sortBy] - a[sortBy];
  };

  switch (algo) {
    case "bubble": bubbleSort(students, compare); break;
    case "insertion": insertionSort(students, compare); break;
    case "selection": selectionSort(students, compare); break;
    case "quick": students = quickSort(students, compare); break;
  }

  saveData();
  renderTable(students);
}

// Sorting Algorithms (use same comparator contract as before: cmp(a,b) > 0 => a should come after b)
function bubbleSort(arr, cmp) {
  for (let i = 0; i < arr.length - 1; i++)
    for (let j = 0; j < arr.length - i - 1; j++)
      if (cmp(arr[j], arr[j + 1]) > 0)
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
}

function insertionSort(arr, cmp) {
  for (let i = 1; i < arr.length; i++) {
    let key = arr[i], j = i - 1;
    while (j >= 0 && cmp(arr[j], key) > 0) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = key;
  }
}

function selectionSort(arr, cmp) {
  for (let i = 0; i < arr.length - 1; i++) {
    let min = i;
    for (let j = i + 1; j < arr.length; j++)
      if (cmp(arr[min], arr[j]) > 0) min = j;
    [arr[i], arr[min]] = [arr[min], arr[i]];
  }
}

function quickSort(arr, cmp) {
  if (arr.length <= 1) return arr.slice();
  const pivot = arr[arr.length - 1];
  const left = arr.filter(x => cmp(x, pivot) < 0);
  const right = arr.filter(x => cmp(x, pivot) > 0);
  const equal = arr.filter(x => cmp(x, pivot) === 0);
  return [...quickSort(left, cmp), ...equal, ...quickSort(right, cmp)];
}

function getTotal(s) {
  return Number(s.math) + Number(s.science) + Number(s.english);
}

function renderTable(data) {
  tbody.innerHTML = "";

  // Determine overall topper (by total) from the full students array
  let topperId = null;
  if (students.length > 0) {
    const totals = students.map(getTotal);
    const maxTotal = Math.max(...totals);
    const idx = totals.indexOf(maxTotal);
    topperId = students[idx] && students[idx].id;
  }

  data.forEach((s, i) => {
    const tr = document.createElement("tr");

    if (s.id === topperId) tr.classList.add("topper");

    // Use student's rank as (i+1) in the displayed array. If you want global rank, generateRankList first.
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.enroll)}</td>
      <td>${s.math}</td>
      <td>${s.science}</td>
      <td>${s.english}</td>
      <td>${getTotal(s)}</td>
      <td>
        <button class="action-btn" data-id="${s.id}" data-action="edit">✏️</button>
        <button class="action-btn" data-id="${s.id}" data-action="delete">🗑️</button>
      </td>`;

    tbody.appendChild(tr);
  });

  // Attach event delegation for action buttons
  tbody.querySelectorAll('.action-btn').forEach(btn => {
    btn.onclick = (e) => {
      const id = Number(btn.getAttribute('data-id'));
      const action = btn.getAttribute('data-action');
      if (action === 'edit') startEditStudent(id);
      if (action === 'delete') deleteStudentById(id);
    };
  });

  updateStats();
}

function startEditStudent(id) {
  const s = students.find(x => x.id === id);
  if (!s) return;
  document.getElementById("name").value = s.name;
  document.getElementById("enroll").value = s.enroll;
  document.getElementById("math").value = s.math;
  document.getElementById("science").value = s.science;
  document.getElementById("english").value = s.english;
  editingId = id;
  addBtn.textContent = "💾 Save";
}

function deleteStudentById(id) {
  const idx = students.findIndex(s => s.id === id);
  if (idx === -1) return;
  if (!confirm(`Delete ${students[idx].name}?`)) return;
  students.splice(idx, 1);
  saveData();
  renderTable(students);
}

function searchStudents() {
  const term = document.getElementById("searchInput").value.toLowerCase();
  const filtered = students.filter(
    s => s.name.toLowerCase().includes(term) || s.enroll.toLowerCase().includes(term)
  );
  renderTable(filtered);
}

function updateStats() {
  totalStudentsEl.textContent = students.length;
  if (students.length === 0) {
    topperNameEl.textContent = "-";
    averageMarksEl.textContent = "0";
    return;
  }
  const totals = students.map(getTotal);
  const avg = (totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(2);
  const topper = students[totals.indexOf(Math.max(...totals))].name;
  topperNameEl.textContent = topper;
  averageMarksEl.textContent = avg;
}

function saveData() {
  localStorage.setItem("students", JSON.stringify(students));
}

function exportCSV() {
  // prepend BOM so Excel recognizes UTF-8 properly
  let csv = "\uFEFFRank,Name,Enrollment,Math,Science,English,Total\n";
  // Use current displayed order
  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (rows.length === 0) {
    // fallback to all students in current array
    students.forEach((s, i) => {
      csv += `${i + 1},${escapeCsv(s.name)},${escapeCsv(s.enroll)},${s.math},${s.science},${s.english},${getTotal(s)}\n`;
    });
  } else {
    rows.forEach((r, i) => {
      const cols = r.querySelectorAll('td');
      const rank = cols[0].textContent;
      const name = cols[1].textContent;
      const enroll = cols[2].textContent;
      const math = cols[3].textContent;
      const science = cols[4].textContent;
      const english = cols[5].textContent;
      const total = cols[6].textContent;
      csv += `${rank},${escapeCsv(name)},${escapeCsv(enroll)},${math},${science},${english},${total}\n`;
    });
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "rank_list.csv";
  link.click();
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  const btn = document.getElementById("themeToggle");
  btn.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
  localStorage.setItem('themeDark', document.body.classList.contains('dark'));
}

// Utils
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeCsv(str) {
  if (typeof str !== 'string') return str;
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Initial render and theme restore
if (localStorage.getItem('themeDark') === 'true') document.body.classList.add('dark');
renderTable(students);
saveData();
