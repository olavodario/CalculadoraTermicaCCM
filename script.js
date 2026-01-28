/**
 * Calculadora Térmica CCM Logic
 */

const STATE = {
    area: 0,
    items: [],
    totalExternalLoadBtu: 0,
    totalEquipLoadKw: 0,
    totalEquipLoadBtu: 0,
    margin: 15
};

// Constants
// Default FACTOR_AREA is now dynamic based on input
const FACTOR_INV = 0.03;
const FACTOR_SOFT_DIR = 0.014;

const KW_TO_BTU = 3412.14;
const BTU_TO_TR = 12000;
const CV_TO_KW = 0.7355;

// DOM Elements
const roomAreaInput = document.getElementById('roomArea');
const refFactorInput = document.getElementById('refFactor'); // New
const externalLoadDisplay = document.getElementById('externalLoadDisplay');

const equipTypeSelect = document.getElementById('equipType');
const equipPowerInput = document.getElementById('equipPower'); // Now accepts CV
const equipQtyInput = document.getElementById('equipQty');
const addEquipBtn = document.getElementById('addEquipBtn');
const equipmentList = document.getElementById('equipmentList');

const sensibleHeatDisplay = document.getElementById('sensibleHeat');
const capacityDiv75Display = document.getElementById('capacityDiv75');
const totalCapacityDisplay = document.getElementById('totalCapacity');
const finalTotalDisplay = document.getElementById('finalTotal');

const recSplit = document.getElementById('recSplit');
const recSelf = document.getElementById('recSelf');
const recAdiabatic = document.getElementById('recAdiabatic');

const converterModal = document.getElementById('converterModal');
const openConverterBtn = document.getElementById('openConverterBtn');
const closeModalBtn = document.querySelector('.close-modal');
const applyConversionBtn = document.getElementById('applyConversionBtn');

// Converter elements (Simplified)
const convKwInput = document.getElementById('convKwInput');
const convResult = document.getElementById('convResult');

// --- Event Listeners ---

roomAreaInput.addEventListener('input', updateExternalLoad);
// refFactorInput is now read-only, updated via modal

addEquipBtn.addEventListener('click', addItem);
openConverterBtn.addEventListener('click', () => {
    converterModal.classList.remove('hidden');
    setTimeout(() => converterModal.classList.add('visible'), 10);
});
closeModalBtn.addEventListener('click', closeConverter);
window.addEventListener('click', (e) => {
    if (e.target === converterModal) closeConverter();
    if (e.target === refFactorModal) closeRefModalFunc();
});

convKwInput.addEventListener('input', calculateConversionPreview);

applyConversionBtn.addEventListener('click', () => {
    const cv = parseFloat(convResult.getAttribute('data-cv'));
    if (cv) {
        equipPowerInput.value = cv.toFixed(2);
        closeConverter();
    }
});

// Reference Factor Modal Logic
const editRefFactorBtn = document.getElementById('editRefFactorBtn');
const refFactorModal = document.getElementById('refFactorModal');
const closeRefModal = document.getElementById('closeRefModal');
const saveRefFactorBtn = document.getElementById('saveRefFactorBtn');
const newRefFactorInput = document.getElementById('newRefFactorInput');

function openRefModalFunc() {
    newRefFactorInput.value = refFactorInput.value;
    refFactorModal.classList.remove('hidden');
    setTimeout(() => refFactorModal.classList.add('visible'), 10);
    newRefFactorInput.focus();
}

function closeRefModalFunc() {
    refFactorModal.classList.remove('visible');
    setTimeout(() => refFactorModal.classList.add('hidden'), 300);
}

editRefFactorBtn.addEventListener('click', openRefModalFunc);
closeRefModal.addEventListener('click', closeRefModalFunc);
saveRefFactorBtn.addEventListener('click', () => {
    const newVal = parseFloat(newRefFactorInput.value);
    if (!isNaN(newVal) && newVal >= 0) {
        refFactorInput.value = newVal;
        updateExternalLoad();
        closeRefModalFunc();
    }
});

// --- Core Logic ---

function updateExternalLoad() {
    const area = parseFloat(roomAreaInput.value) || 0;
    const factor = parseFloat(refFactorInput.value) || 0;

    STATE.area = area;
    STATE.totalExternalLoadBtu = area * factor;
    renderResults();
}

function addItem() {
    const type = equipTypeSelect.value;
    const typeLabel = equipTypeSelect.options[equipTypeSelect.selectedIndex].text;
    const powerCv = parseFloat(equipPowerInput.value) || 0; // Input is CV
    const qty = parseInt(equipQtyInput.value) || 1;

    if (powerCv <= 0) return;

    // Convert CV to kW
    const powerKw = powerCv * CV_TO_KW;
    const powerKwTotal = powerKw * qty;

    let dissipationFactor = 0;
    if (type === 'inversor') dissipationFactor = FACTOR_INV;
    else dissipationFactor = FACTOR_SOFT_DIR;

    const dissipatedKw = powerKwTotal * dissipationFactor;
    const dissipatedBtu = dissipatedKw * KW_TO_BTU;

    const item = {
        id: Date.now(),
        type,
        typeLabel,
        powerCv,
        powerKw: powerKw, // Store for ref
        qty,
        dissipatedKw,
        dissipatedBtu
    };

    STATE.items.push(item);
    renderList();
    renderResults();

    // Reset inputs
    equipPowerInput.value = '';
    equipQtyInput.value = '1';
    equipPowerInput.focus();
}

function removeItem(id) {
    STATE.items = STATE.items.filter(item => item.id !== id);
    renderList();
    renderResults();
}

function renderList() {
    equipmentList.innerHTML = '';
    STATE.items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.typeLabel}</td>
            <td>${item.qty}</td>
            <td>${item.powerCv} CV (Dissip: ${item.dissipatedKw.toFixed(2)} kW)</td>
            <td>${Math.round(item.dissipatedBtu).toLocaleString()}</td>
            <td><button class="delete-btn" onclick="removeItem(${item.id})"><i class="fas fa-trash"></i></button></td>
        `;
        equipmentList.appendChild(row);
    });
}

function renderResults() {
    STATE.totalEquipLoadBtu = STATE.items.reduce((acc, item) => acc + item.dissipatedBtu, 0);

    // 1. Calor Sensível = Equipment Load ONLY
    const sensibleBtu = STATE.totalEquipLoadBtu;
    const sensibleTR = sensibleBtu / BTU_TO_TR;

    // 2. Capacidade Total = Sensible / 0.75
    const capacityDiv75TR = sensibleTR / 0.75;

    // 3. Carga Total (+Margin%)
    const marginPercent = STATE.margin || 15;
    const totalCapacityMarginedTR = capacityDiv75TR * (1 + (marginPercent / 100));

    // 4. Final Total = Margined Capacity + External Load
    const externalLoadTR = STATE.totalExternalLoadBtu / BTU_TO_TR;
    const finalTotalTR = totalCapacityMarginedTR + externalLoadTR;
    const finalTotalBtu = finalTotalTR * BTU_TO_TR;

    externalLoadDisplay.innerHTML = `${Math.round(STATE.totalExternalLoadBtu).toLocaleString()} BTU/h <span class="highlight-tr">(${externalLoadTR.toFixed(1)} TR)</span>`;

    // Update Logic Displays
    sensibleHeatDisplay.innerHTML = `${sensibleTR.toFixed(1)} TR`;
    if (capacityDiv75Display) capacityDiv75Display.innerText = `${capacityDiv75TR.toFixed(1)} TR`;

    // Update label to reflect current margin
    document.getElementById('marginLabel').innerText = `Carga Total + Fator de Segurança (+${marginPercent}%)`;
    totalCapacityDisplay.innerText = `${totalCapacityMarginedTR.toFixed(1)} TR`;

    // Final Result
    if (finalTotalDisplay) finalTotalDisplay.innerText = `${finalTotalTR.toFixed(1)} TR`;

    recSplit.innerText = `${Math.ceil(finalTotalTR)} TR`;
    recSelf.innerText = `${Math.ceil(finalTotalTR)} TR`;
    recAdiabatic.innerText = `~${(finalTotalBtu / 10).toLocaleString()} m³/h (Est.)`;
}

// --- Margin Modal Logic ---
const editMarginBtn = document.getElementById('editMarginBtn');
const marginModal = document.getElementById('marginModal');
const closeMarginModal = document.getElementById('closeMarginModal');
const saveMarginBtn = document.getElementById('saveMarginBtn');
const newMarginInput = document.getElementById('newMarginInput');

function openMarginModalFunc() {
    newMarginInput.value = STATE.margin || 15;
    marginModal.classList.remove('hidden');
    setTimeout(() => marginModal.classList.add('visible'), 10);
    newMarginInput.focus();
}

function closeMarginModalFunc() {
    marginModal.classList.remove('visible');
    setTimeout(() => marginModal.classList.add('hidden'), 300);
}

if (editMarginBtn) editMarginBtn.addEventListener('click', openMarginModalFunc);
if (closeMarginModal) closeMarginModal.addEventListener('click', closeMarginModalFunc);
window.addEventListener('click', (e) => {
    if (e.target === marginModal) closeMarginModalFunc();
});

if (saveMarginBtn) {
    saveMarginBtn.addEventListener('click', () => {
        const newVal = parseFloat(newMarginInput.value);
        if (!isNaN(newVal) && newVal >= 0) {
            STATE.margin = newVal;
            renderResults();
            closeMarginModalFunc();
        }
    });
}

// --- Converter ---

function calculateConversionPreview() {
    const kw = parseFloat(convKwInput.value) || 0;

    // kW to CV
    const cv = kw / CV_TO_KW;

    convResult.innerText = `${cv.toFixed(2)} CV`;
    convResult.setAttribute('data-cv', cv);
}

function closeConverter() {
    converterModal.classList.remove('visible');
    setTimeout(() => converterModal.classList.add('hidden'), 300);
}

// Expose globally
window.removeItem = removeItem;
