document.addEventListener('DOMContentLoaded', () => {
    // 1. GWP 係數資料庫 (AR5 / AR6)
    const GWP_DATA = {
        "CF4": { "AR5": 6630, "AR6": 7380 }, "C2F6": { "AR5": 11100, "AR6": 12400 }, "CHF3": { "AR5": 12400, "AR6": 14600 },
        "CH2F2": { "AR5": 677, "AR6": 771 }, "CH3F": { "AR5": 116, "AR6": 135 }, "C3F8": { "AR5": 8900, "AR6": 9290 },
        "c-C4F8": { "AR5": 9540, "AR6": 10200 }, "NF3": { "AR5": 16100, "AR6": 17400 }, "SF6": { "AR5": 23500, "AR6": 24300 },
        "C4F6": { "AR5": 0, "AR6": 0 }, "C5F8": { "AR5": 2, "AR6": 2 }, "C4F8O": { "AR5": 0, "AR6": 0 },
        "C2HF5": { "AR5": 3170, "AR6": 3500 }, "N2O": { "AR5": 265, "AR6": 273 }
    };

    // 2. 尾氣處理去除率 DRE (d_j)
    const DRE_FACTORS = {
        "CF4": 0.89, "C2F4": 0.98, "C2F6": 0.98, "C3F8": 0.99, "C4F6": 0.98, "c-C4F8": 0.98, "C4F8O": 0.98, "C5F8": 0.98,
        "CHF3": 0.98, "CH2F2": 0.99, "CH3F": 0.99, "C2HF5": 0.98, "NF3": 0.95, "SF6": 0.96, "N2O": 0.60
    };

    // 3. 300mm (12吋) 排放因子庫 (已校正 Bc-C4F8)
    const EF_300MM = {
        "(1-Ui)": {"CF4":0.65,"C2F6":0.80,"C3F8":0.30,"C4F6":0.15,"c-C4F8":0.18,"C5F8":0.10,"CHF3":0.38,"CH2F2":0.20,"CH3F":0.32,"NF3":0.16,"SF6":0.29,"N2O":0.00},
        "BCF4": {"CF4":0.0,"C2F6":0.21,"C3F8":0.21,"C4F6":0.059,"c-C4F8":0.045,"C5F8":0.11,"CHF3":0.076,"CH2F2":0.060,"CH3F":0.031,"NF3":0.045,"SF6":0.034},
        "BC2F6": {"CF4":0.061,"C2F6":0.0,"C3F8":0.18,"C4F6":0.062,"c-C4F8":0.027,"C5F8":0.083,"CHF3":0.062,"CH2F2":0.044,"CH3F":0.011,"NF3":0.045,"SF6":0.041},
        "BC3F8": {"C5F8":0.00012},
        "BC4F6": {"CF4":0.0015,"c-C4F8":0.0094,"CHF3":0.0001,"CH3F":0.0012},
        "Bc-C4F8": {"CF4":0.0033,"C4F6":0.0051,"CHF3":0.00067,"CH2F2":0.072,"CH3F":0.007},
        "BCH3F": {"CF4":0.0053,"C3F8":0.00073,"C4F6":0.00065,"c-C4F8":0.0022,"CHF3":0.037,"CH2F2":0.0044,"NF3":0.008,"SF6":0.0082},
        "BCH2F2": {"CF4":0.014,"C4F6":0.00003,"c-C4F8":0.0014,"CHF3":0.0026,"CH3F":0.0023,"NF3":0.00086,"SF6":0.00002},
        "BCHF3": {"CF4":0.013,"C3F8":0.012,"C4F6":0.017,"c-C4F8":0.029,"C5F8":0.0069,"CH2F2":0.057,"CH3F":0.0016,"NF3":0.025,"SF6":0.0039}
    };

    // 4. 200mm (8吋) 排放因子庫
    const EF_200MM = {
        "(1-Ui)":{"CF4":0.70,"C2F6":0.60,"C3F8":0.40,"c-C4F8":0.20,"CHF3":0.30,"NF3":0.20,"SF6":0.50},
        "BCF4":{"C2F6":0.10,"C3F8":0.10,"c-C4F8":0.10,"CHF3":0.10,"NF3":0.10},
        "BC2F6":{"C3F8":0.10,"c-C4F8":0.10},
        "BCHF3":{"c-C4F8":0.05}
    };

    // LocalStorage 鍵值與筆數上限
    const STORAGE_KEY = 'GHG_TIER2C_SAVED_RECORDS';
    const MAX_RECORDS = 20;

    // DOM 元素綁定
    const gasSelect = document.getElementById('gas-select');
    const activityInput = document.getElementById('activity-data');
    const allocationInput = document.getElementById('allocation-rate');
    const gwpVersionSelect = document.getElementById('gwp-version');
    const heelFactorSelect = document.getElementById('heel-factor');
    const waferSizeSelect = document.getElementById('wafer-size');
    const utValueInput = document.getElementById('ut-value');
    const calculateBtn = document.getElementById('calculate-btn');
    const saveBtn = document.getElementById('save-btn');
    const clearAllBtn = document.getElementById('clear-all-btn');
    const resultsOutput = document.getElementById('results-output');
    const totalEmissionsEl = document.getElementById('total-emissions');
    const historyContainer = document.getElementById('history-container');
    const recordCountEl = document.getElementById('record-count');

    // 精確四捨五入函數
    function roundTo(num, decimals) {
        const factor = Math.pow(10, decimals);
        return Math.round((num + Number.EPSILON) * factor) / factor;
    }

    // 初始化氣體選單
    const gasList = Object.keys(EF_300MM['(1-Ui)']).filter(g => g !== 'N2O');
    gasList.sort().forEach(gas => {
        const opt = document.createElement('option');
        opt.value = gas;
        opt.textContent = gas;
        gasSelect.appendChild(opt);
    });
    gasSelect.value = 'c-C4F8';

    // 格式化數值輸入 (小數點 4 位)
    [activityInput, allocationInput, utValueInput].forEach(input => {
        input.addEventListener('blur', () => {
            const val = parseFloat(input.value);
            if (!isNaN(val)) input.value = val.toFixed(4);
        });
    });

    // 核心計算函數
    function calculateEmissions() {
        const gas = gasSelect.value;
        const rawActivity = parseFloat(activityInput.value) || 0;
        const allocationPercent = parseFloat(allocationInput.value) || 0;
        const gwpVersion = gwpVersionSelect.value;
        const heelMultiplier = parseFloat(heelFactorSelect.value) || 1.0;
        const waferSize = waferSizeSelect.value;
        const utPercent = parseFloat(utValueInput.value) || 0;

        const netActivity = rawActivity * (allocationPercent / 100) * heelMultiplier;
        const utRatio = utPercent / 100;
        const EF_TABLE = waferSize === '300' ? EF_300MM : EF_200MM;

        let totalCO2e = 0;
        let tableRows = '';

        // 1. 母氣體計算
        const oneMinusUi = EF_TABLE['(1-Ui)']?.[gas] ?? 0;
        const inputDRE = DRE_FACTORS[gas] ?? 0;
        const inputAbatementFactor = 1 - (utRatio * inputDRE);
        const inputGasEmissionRaw = netActivity * oneMinusUi * inputAbatementFactor;
        const inputGasEmission = roundTo(inputGasEmissionRaw, 4);
        const inputGasGWP = GWP_DATA[gas]?.[gwpVersion] ?? 0;
        const inputGasCO2e = roundTo(inputGasEmission * inputGasGWP, 4);
        totalCO2e += inputGasCO2e;

        tableRows += `<tr>
            <td><span class="badge-input">輸入氣體</span></td>
            <td><strong>${gas}</strong></td>
            <td>${oneMinusUi.toFixed(4)}</td>
            <td>${(inputDRE * 100).toFixed(1)}%</td>
            <td>${inputGasEmission.toFixed(4)}</td>
            <td>${inputGasGWP.toLocaleString()}</td>
            <td><strong>${inputGasCO2e.toFixed(4)}</strong></td>
        </tr>`;

        // 2. 副產物計算
        for (const factorKey in EF_TABLE) {
            if (factorKey.startsWith('B')) {
                const byProductGas = factorKey.substring(1);
                const byProductEf = EF_TABLE[factorKey]?.[gas] ?? 0;

                if (byProductEf > 0) {
                    const byProductDRE = DRE_FACTORS[byProductGas] ?? 0;
                    const byProductAbatementFactor = 1 - (utRatio * byProductDRE);
                    const byProductEmissionRaw = netActivity * byProductEf * byProductAbatementFactor;
                    const byProductEmission = roundTo(byProductEmissionRaw, 4);
                    const byProductGWP = GWP_DATA[byProductGas]?.[gwpVersion] ?? 0;
                    const byProductCO2e = roundTo(byProductEmission * byProductGWP, 4);
                    totalCO2e += byProductCO2e;

                    tableRows += `<tr>
                        <td><span class="badge-byproduct">副產物</span></td>
                        <td>${byProductGas}</td>
                        <td>${byProductEf.toFixed(4)}</td>
                        <td>${(byProductDRE * 100).toFixed(1)}%</td>
                        <td>${byProductEmission.toFixed(4)}</td>
                        <td>${byProductGWP.toLocaleString()}</td>
                        <td><strong>${byProductCO2e.toFixed(4)}</strong></td>
                    </tr>`;
                }
            }
        }

        // 渲染結果明細
        resultsOutput.innerHTML = `<table>
            <thead><tr>
                <th>類別</th><th>氣體名稱</th><th>未破壞/生成係數</th>
                <th>削減率 (DRE)</th><th>實質排放量 (噸)</th>
                <th>GWP (${gwpVersion})</th><th>排放當量 (tCO₂e)</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
        </table>`;
        
        const finalTotal = roundTo(totalCO2e, 4).toFixed(4);
        totalEmissionsEl.innerHTML = `${finalTotal} <span class="unit">tCO₂e</span>`;
        return finalTotal;
    }

    // --- 歷史紀錄管理邏輯 ---
    function getStoredRecords() {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    }
    function saveRecords(records) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        renderHistory();
    }
    function renderHistory() {
        const records = getStoredRecords();
        recordCountEl.textContent = `(${records.length} / ${MAX_RECORDS})`;

        if (records.length === 0) {
            historyContainer.innerHTML = `<div class="empty-history">📭 目前尚無儲存紀錄，試算完成後點擊「💾 儲存此筆試算紀錄」即可保存！</div>`;
            return;
        }

        let rows = '';
        records.forEach(rec => {
            rows += `<tr>
                <td>${rec.time}</td>
                <td><strong>${rec.gas}</strong></td>
                <td>${parseFloat(rec.activity).toFixed(4)}</td>
                <td>${parseFloat(rec.allocation).toFixed(2)}%</td>
                <td>${rec.waferSize}mm</td>
                <td>${rec.gwpVersion}</td>
                <td>${rec.heelFactor === '1.0' ? '1.0 (是)' : '0.9 (否)'}</td>
                <td>${parseFloat(rec.utValue).toFixed(2)}%</td>
                <td class="cell-highlight">${rec.totalCO2e}</td>
                <td>
                    <button class="btn-load" onclick="window.loadRecord('${rec.id}')">帶回</button>
                    <button class="btn-delete" onclick="window.deleteRecord('${rec.id}')">刪除</button>
                </td>
            </tr>`;
        });

        historyContainer.innerHTML = `
            <table class="history-table">
                <thead>
                    <tr>
                        <th>儲存時間</th>
                        <th>氣體</th>
                        <th>活動數據 (噸)</th>
                        <th>分配率</th>
                        <th>晶圓</th>
                        <th>GWP</th>
                        <th>殘氣乘數</th>
                        <th>UT值</th>
                        <th>總排放量 (tCO₂e)</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    // 儲存當前資料按鈕
    saveBtn.addEventListener('click', () => {
        const currentTotal = calculateEmissions();
        const records = getStoredRecords();

        const now = new Date();
        const timeStr = `${now.getMonth() + 1}/${now.getDate()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const newRecord = {
            id: 'REC_' + Date.now(),
            time: timeStr,
            gas: gasSelect.value,
            activity: parseFloat(activityInput.value) || 0,
            allocation: parseFloat(allocationInput.value) || 0,
            gwpVersion: gwpVersionSelect.value,
            heelFactor: heelFactorSelect.value,
            waferSize: waferSizeSelect.value,
            utValue: parseFloat(utValueInput.value) || 0,
            totalCO2e: currentTotal
        };

        records.unshift(newRecord);
        if (records.length > MAX_RECORDS) {
            records.pop();
        }
        saveRecords(records);
    });

    // 清空歷史按鈕
    clearAllBtn.addEventListener('click', () => {
        const records = getStoredRecords();
        if (records.length === 0) return;
        if (confirm('確定要清空所有的儲存紀錄嗎？')) {
            saveRecords([]);
        }
    });

    // 點選「帶回」與「刪除」全域函數
    window.loadRecord = function(id) {
        const records = getStoredRecords();
        const target = records.find(r => r.id === id);
        if (!target) return;

        gasSelect.value = target.gas;
        activityInput.value = parseFloat(target.activity).toFixed(4);
        allocationInput.value = parseFloat(target.allocation).toFixed(4);
        gwpVersionSelect.value = target.gwpVersion;
        heelFactorSelect.value = target.heelFactor;
        waferSizeSelect.value = target.waferSize;
        utValueInput.value = parseFloat(target.utValue).toFixed(4);

        calculateEmissions();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.deleteRecord = function(id) {
        let records = getStoredRecords();
        records = records.filter(r => r.id !== id);
        saveRecords(records);
    };

    // 事件監聽綁定
    [gasSelect, gwpVersionSelect, heelFactorSelect, waferSizeSelect].forEach(el => {
        el.addEventListener('change', calculateEmissions);
    });
    [activityInput, allocationInput, utValueInput].forEach(el => {
        el.addEventListener('input', calculateEmissions);
    });

    // 初始執行
    calculateEmissions();
    renderHistory();
});
