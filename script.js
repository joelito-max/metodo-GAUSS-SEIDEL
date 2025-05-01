import * as math from 'mathjs';

const numBusesInput = document.getElementById('num-buses');
const ybusMatrixContainer = document.getElementById('ybus-matrix-container');
const busCardsContainer = document.getElementById('bus-cards-container');
const runButton = document.getElementById('run-button');
const outputDiv = document.getElementById('output');
const resultsTableBody = document.querySelector('#results-table tbody');
const convergenceInfo = document.getElementById('convergence-info');
const errorLog = document.getElementById('error-log');
const networkCanvas = document.getElementById('network-canvas');
const ctx = networkCanvas.getContext('2d');

const defaultBusData = [
    { type: 'Slack', v_mag: 1.0, v_phase: 0, p_gen: 0, q_gen: 0, p_load: 0, q_load: 0 },
    { type: 'PQ', v_mag: 1.0, v_phase: 0, p_gen: 0, q_gen: 0, p_load: 0.5, q_load: 0.2 },
    { type: 'PV', v_mag: 1.02, v_phase: 0, p_gen: 0.8, q_gen: 0, p_load: 0, q_load: 0 },
];

// Default Ybus only for the initial 3x3 case
const defaultYbusStrings_3x3 = [
    ['3<-90', '1<90', '2<90'],
    ['1<90', '2.8<-90', '1.8<90'],
    ['2<90', '1.8<90', '3.8<-90']
];

const BUS_RADIUS = 15;
const BUS_SPACING = 80;
const CANVAS_PADDING = 30;
const BUS_COLOR = "#4fc3f7";
const BUS_HIGHLIGHT_COLOR = "#ffab40";
const BUS_TEXT_COLOR = "#e0e0e0";
const BUS_LABEL_FONT = "12px Orbitron";
const BUS_NUMBER_FONT = "bold 14px Orbitron";

let busPositions = [];
let highlightedBusIndex = -1;

function degToRad(degrees) {
    return degrees * (Math.PI / 180);
}

function radToDeg(radians) {
    return radians * (180 / Math.PI);
}

function parseComplex(str) {
    if (!str || typeof str !== 'string') return math.complex(0, 0);
    str = str.trim().toLowerCase().replace(/\s+/g, '');

    const polarMatch = str.match(/^([\d.-]+)<([\d.-]+)$/);
    if (polarMatch) {
        const mag = parseFloat(polarMatch[1]);
        const angleDeg = parseFloat(polarMatch[2]);
        // Allow magnitude 0, but show warning if negative
        if (!isNaN(mag) && !isNaN(angleDeg)) {
             if (mag < 0) {
                  console.warn(`Formato polar inválido: "${str}". Magnitud debe ser >= 0. Usando magnitud ${Math.abs(mag)}.`);
                  // Allow negative magnitude by using absolute value, but keep the angle
                  // This might be non-standard but provides a complex number
                  const angleRad = degToRad(angleDeg);
                  return math.complex({ r: Math.abs(mag), phi: angleRad });
             }
             const angleRad = degToRad(angleDeg);
             return math.complex({ r: mag, phi: angleRad });
        } else {
             console.warn(`Formato polar inválido: "${str}". Ambos valores deben ser números. Usando 0<0.`);
             throw new Error(`Formato polar inválido: "${str}". Magnitud debe ser no negativa y ambos valores deben ser números.`);
        }
    }

    console.warn(`Formato inválido: "${str}". Solo se acepta 'magnitud<ángulo_grados'. Usando 0<0.`);
    throw new Error(`Formato inválido: "${str}". Ingrese el valor en formato polar: 'magnitud<ángulo_grados'.`);
}

function displayError(message) {
    errorLog.textContent = message;
    const resultsPlaceholder = document.querySelector('#output p');
    if (resultsPlaceholder) resultsPlaceholder.textContent = 'Los resultados aparecerán aquí después de ejecutar la simulación.';
    resultsTableBody.innerHTML = '';
    convergenceInfo.textContent = '';
}

function clearError() {
     errorLog.textContent = '';
}

function calculateBusPositions(numBuses, canvasWidth) {
    busPositions = [];
    const totalWidthNeeded = (numBuses - 1) * BUS_SPACING + 2 * CANVAS_PADDING;
    let startX = Math.max(CANVAS_PADDING, (canvasWidth - totalWidthNeeded) / 2 + CANVAS_PADDING);
    const yPos = networkCanvas.height / 2;

    for (let i = 0; i < numBuses; i++) {
        busPositions.push({ x: startX + i * BUS_SPACING, y: yPos });
    }
}

function drawNetworkDiagram() {
    const numBuses = parseInt(numBusesInput.value) || 0;
    const canvasWidth = networkCanvas.width;
    const canvasHeight = networkCanvas.height;

    // Adjust canvas width dynamically based on the number of buses
    networkCanvas.width = Math.max(600, (numBuses - 1) * BUS_SPACING + 2 * BUS_RADIUS + 2 * CANVAS_PADDING);

    ctx.clearRect(0, 0, networkCanvas.width, networkCanvas.height);

    if (numBuses <= 0) return;

    calculateBusPositions(numBuses, networkCanvas.width);

    // Draw line connecting buses if more than one
    if (numBuses > 1) {
        ctx.beginPath();
        ctx.moveTo(busPositions[0].x, busPositions[0].y);
        ctx.lineTo(busPositions[numBuses - 1].x, busPositions[numBuses - 1].y);
        ctx.strokeStyle = 'rgba(79, 195, 247, 0.4)'; // Bluish color for the line
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // Draw each bus
    busPositions.forEach((pos, i) => {
        const isHighlighted = (i === highlightedBusIndex);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, BUS_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = isHighlighted ? BUS_HIGHLIGHT_COLOR : BUS_COLOR;
        ctx.fill();
        if (isHighlighted) {
            ctx.strokeStyle = BUS_HIGHLIGHT_COLOR; // Highlight border
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Draw bus number inside the circle
        ctx.fillStyle = "#1a1a2e"; // Dark background for contrast
        ctx.font = BUS_NUMBER_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i + 1, pos.x, pos.y + 1); // Slight offset for centering

        // Draw bus label below the circle
        ctx.fillStyle = BUS_TEXT_COLOR;
        ctx.font = BUS_LABEL_FONT;
        ctx.fillText(`Barra ${i + 1}`, pos.x, pos.y + BUS_RADIUS + 15);
    });
}

function highlightBus(index) {
    // Remove highlight from previously highlighted card
    const highlightedCard = busCardsContainer.querySelector('.highlighted');
    if (highlightedCard) {
        highlightedCard.classList.remove('highlighted');
    }

    highlightedBusIndex = index;

    // Add highlight to the new card if index is valid
    if (index !== -1) {
        const cardToHighlight = busCardsContainer.children[index];
        if (cardToHighlight) {
            cardToHighlight.classList.add('highlighted');
        }
    }

    drawNetworkDiagram(); // Redraw diagram to show highlighted bus
}

function generateYbusGrid() {
    const numBuses = parseInt(numBusesInput.value) || 0;
    ybusMatrixContainer.innerHTML = ''; // Clear previous grid

    if (numBuses <= 0) return;

    ybusMatrixContainer.style.setProperty('--num-buses', numBuses); // Update CSS variable for grid columns

    for (let i = 0; i < numBuses; i++) {
        for (let j = 0; j < numBuses; j++) {
            const input = document.createElement('input');
            input.type = 'text'; // Text input for polar format
            input.classList.add('ybus-cell');
            input.dataset.row = i;
            input.dataset.col = j;

            // Set default value
            let defaultValue = '0<0'; // Default for any size n x n
            // Use specific defaults only if numBuses is 3
            if (numBuses === 3 && defaultYbusStrings_3x3[i] && defaultYbusStrings_3x3[i][j]) {
                defaultValue = defaultYbusStrings_3x3[i][j];
            }
            input.value = defaultValue;

            input.setAttribute('aria-label', `Ybus elemento ${i + 1},${j + 1}`);
            ybusMatrixContainer.appendChild(input);
        }
    }
}

function generateBusCards() {
    const numBuses = parseInt(numBusesInput.value) || 0;
    busCardsContainer.innerHTML = ''; // Clear previous cards
    highlightedBusIndex = -1; // Reset highlight

    if (numBuses <= 0) {
        drawNetworkDiagram(); // Clear diagram if no buses
        return;
    }

    for (let i = 0; i < numBuses; i++) {
        const card = document.createElement('div');
        card.classList.add('bus-card');
        card.dataset.index = i; // Store bus index
        // Get default data, fall back if index is out of bounds
        const defaultData = defaultBusData[i] || defaultBusData[1] || { type: 'PQ', v_mag: 1.0, v_phase: 0, p_gen: 0, q_gen: 0, p_load: 0, q_load: 0 };

        card.innerHTML = `
            <h3>Barra ${i + 1}</h3>
            <div class="card-section">
                <label for="bus-type-${i}">Tipo:</label>
                <select id="bus-type-${i}" class="bus-type">
                    <option value="Slack" ${defaultData.type === 'Slack' ? 'selected' : ''}>Slack</option>
                    <option value="PV" ${defaultData.type === 'PV' ? 'selected' : ''}>PV</option>
                    <option value="PQ" ${defaultData.type === 'PQ' ? 'selected' : ''}>PQ</option>
                </select>
            </div>
            <div class="card-section">
                <label>Voltaje Inicial:</label>
                <div class="input-group">
                    <label for="v-mag-${i}">|V| (pu):</label>
                    <input type="number" id="v-mag-${i}" class="v-mag" step="0.01" value="${defaultData.v_mag}">
                    <label for="v-phase-${i}">Fase (°):</label>
                    <input type="number" id="v-phase-${i}" class="v-phase" step="any" value="${defaultData.v_phase}">
                </div>
            </div>
             <div class="card-section">
                 <label>Generación (pu):</label>
                 <div class="input-group">
                     <label for="p-gen-${i}">P gen:</label>
                     <input type="number" id="p-gen-${i}" class="p-gen" step="any" value="${defaultData.p_gen}">
                     <label for="q-gen-${i}">Q gen:</label>
                     <input type="number" id="q-gen-${i}" class="q-gen" step="any" value="${defaultData.q_gen}">
                 </div>
            </div>
            <div class="card-section">
                 <label>Carga (pu):</label>
                 <div class="input-group">
                    <label for="p-load-${i}">P carga:</label>
                    <input type="number" id="p-load-${i}" class="p-load" step="any" value="${defaultData.p_load}">
                    <label for="q-load-${i}">Q carga:</label>
                    <input type="number" id="q-load-${i}" class="q-load" step="any" value="${defaultData.q_load}">
                 </div>
            </div>
        `;
        busCardsContainer.appendChild(card);

        // Add event listeners for hover highlighting
        card.addEventListener('mouseenter', () => highlightBus(i));
        card.addEventListener('mouseleave', () => highlightBus(-1));
    }

    drawNetworkDiagram(); // Draw the initial diagram
}

function parseInputs() {
    clearError();
    const numBuses = parseInt(numBusesInput.value);
    if (isNaN(numBuses) || numBuses <= 0) {
        throw new Error("Número de barras inválido.");
    }

    // Validate Ybus matrix inputs
    const ybusCells = ybusMatrixContainer.querySelectorAll('.ybus-cell');
    if (ybusCells.length !== numBuses * numBuses) {
        throw new Error(`La cuadrícula Ybus tiene ${ybusCells.length} celdas, pero se esperaban ${numBuses * numBuses}. ¿Cambió el número de barras?`);
    }

    const Ybus = Array(numBuses).fill(null).map(() => Array(numBuses).fill(null));
    let parseErrorOccurred = false;
    ybusCells.forEach(cell => {
         const i = parseInt(cell.dataset.row);
         const j = parseInt(cell.dataset.col);
         const valStr = cell.value;
         try {
             Ybus[i][j] = parseComplex(valStr);
             cell.classList.remove('input-error'); // Remove error style if parse succeeds
         } catch (e) {
             cell.classList.add('input-error'); // Add error style if parse fails
             parseErrorOccurred = true;
             console.error(`Error al parsear Ybus[${i+1}, ${j+1}]: ${valStr}. ${e.message}`);
         }
    });

     // If any Ybus cell failed parsing, stop and report
     if (parseErrorOccurred) {
          throw new Error(`Error al parsear uno o más elementos de Ybus. Revise las celdas marcadas en rojo.`);
     }

    // Validate bus data inputs
    const busCards = busCardsContainer.querySelectorAll('.bus-card');
    if (busCards.length !== numBuses) {
        throw new Error(`El contenedor de datos de barras tiene ${busCards.length} tarjetas, pero se esperaban ${numBuses}.`);
    }

    let slackBusIndex = -1;
    let slackBusCount = 0;
    const busData = [];
    const V_initial = [];

    busCards.forEach((card, i) => {
        const type = card.querySelector('.bus-type').value;
        const v_mag = parseFloat(card.querySelector('.v-mag').value);
        const v_phase_deg = parseFloat(card.querySelector('.v-phase').value);
        const p_gen = parseFloat(card.querySelector('.p-gen').value);
        const q_gen = parseFloat(card.querySelector('.q-gen').value);
        const p_load = parseFloat(card.querySelector('.p-load').value);
        const q_load = parseFloat(card.querySelector('.q-load').value);

        // Check for NaN values in numeric inputs
        if (isNaN(v_mag) || isNaN(v_phase_deg) || isNaN(p_gen) || isNaN(q_gen) || isNaN(p_load) || isNaN(q_load)) {
             throw new Error(`Entrada numérica inválida para la barra ${i + 1}. Por favor, revise todos los valores.`);
        }

        const P_spec = p_gen - p_load; // Net active power injection
        const Q_spec = q_gen - q_load; // Net reactive power injection

        if (type === 'Slack') {
            slackBusIndex = i;
            slackBusCount++;
        }

        // Convert initial voltage to complex number
        const v_phase_rad = degToRad(v_phase_deg);
        const initialVoltage = math.complex({ r: v_mag, phi: v_phase_rad });
        V_initial.push(initialVoltage);

        busData.push({
            index: i,
            type: type,
            P_spec: P_spec, // Specified P (Pgen - Pload)
            Q_spec: Q_spec, // Specified Q (Qgen - Qload)
            V_target_mag: v_mag, // Target voltage magnitude (for PV/Slack)
        });
    });

    // Validate slack bus configuration
    if (slackBusCount !== 1) {
        throw new Error(`Se esperaba exactamente una barra Slack, pero se encontraron ${slackBusCount}.`);
    }
    // This check is redundant due to the count check, but kept for clarity
    if (slackBusIndex === -1) {
         throw new Error("No se definió una barra Slack.");
    }

    return { numBuses, Ybus, busData, V_initial, slackBusIndex };
}

function runGaussSeidel() {
    let inputs;
    try {
        inputs = parseInputs();
        // Clear placeholder text only if inputs are valid
        const resultsPlaceholder = document.querySelector('#output p');
        if (resultsPlaceholder && resultsPlaceholder.textContent.startsWith('Los resultados aparecerán')) {
            resultsPlaceholder.textContent = '';
        }
        clearError(); // Clear any previous error messages
    } catch (error) {
        displayError(`Error de Entrada: ${error.message}`);
        return; // Stop execution if there's an input error
    }

    const { numBuses, Ybus, busData, V_initial, slackBusIndex } = inputs;

    let V = [...V_initial]; // Start with the initial voltage vector

    console.log("Iniciando Gauss-Seidel (1 iteración)...");
    console.log("V Inicial:", V.map(v => ({mag: v.toPolar().r.toFixed(5), deg: radToDeg(v.toPolar().phi).toFixed(5)})));
    console.log("Datos de Barras:", busData);

    const V_prev_iter = V.map(v => v.clone()); // Keep values from the start of the iteration

    // Perform one iteration of Gauss-Seidel
    for (let k = 0; k < numBuses; k++) {
        // Skip Slack bus - its voltage is fixed
        if (k === slackBusIndex) {
            V[k] = V_initial[k]; // Ensure Slack voltage remains constant
            continue;
        }

        const bus = busData[k];
        const Vk_old_iter = V_prev_iter[k]; // Voltage at the beginning of this iteration

        // Calculate sum(Y_kj * V_j) for j != k
        let sum = math.complex(0, 0);
        for (let j = 0; j < numBuses; j++) {
            if (k !== j) {
                // Use updated voltage V[j] if j < k (already calculated in this iter)
                // Use previous iteration voltage V_prev_iter[j] if j > k
                const Vj_to_use = (j < k) ? V[j] : V_prev_iter[j];
                sum = math.add(sum, math.multiply(Ybus[k][j], Vj_to_use));
             }
         }

         let Vk_new; // The new voltage for bus k to be calculated

         // Check for zero diagonal element in Ybus to avoid division by zero
         if (math.equal(Ybus[k][k], 0) || math.abs(Ybus[k][k]) < 1e-12) {
              console.error(`Error: Ybus[${k+1}][${k+1}] es cero o cercano a cero. No se puede dividir.`);
              displayError(`Error: Ybus[${k+1}][${k+1}] es cero o cercano a cero (${Ybus[k][k]}). No se puede dividir.`);
              return; // Stop calculation
         }

         // Calculate new voltage based on bus type
         if (bus.type === 'PQ') {
             // Formula: Vk = (1/Ykk) * [ (Pk - jQk) / conj(Vk_old) - sum(Ykj * Vj) ]
             // Use voltage from the START of the iteration (Vk_old_iter) for the conjugate term
             const conjVk_old = math.conj(Vk_old_iter);
             let Vk_intermediate;
             // Handle potential division by zero if voltage is near zero
             if (math.abs(conjVk_old) < 1e-9) {
                  console.warn(`Voltaje cercano a cero para barra PQ ${k+1}. Usando 0+0j como intermedio.`);
                  Vk_intermediate = math.complex(0,0); // Avoid NaN/Infinity
             } else {
                 const pqTerm = math.divide(math.complex(bus.P_spec, -bus.Q_spec), conjVk_old);
                 const numerator = math.subtract(pqTerm, sum);
                 Vk_intermediate = math.divide(numerator, Ybus[k][k]);
             }

             // The prompt requested recalculating with the conjugate of the *newly calculated* intermediate voltage
             // This is a specific (perhaps non-standard) variation of the algorithm.
             const conjVk_intermediate = math.conj(Vk_intermediate);
             if (math.abs(conjVk_intermediate) < 1e-9) {
                   console.warn(`Voltaje intermedio cercano a cero para barra PQ ${k+1}. Usando el valor intermedio como final.`);
                   Vk_new = Vk_intermediate; // If intermediate is ~0, use it directly
             } else {
                 const pqTerm_final = math.divide(math.complex(bus.P_spec, -bus.Q_spec), conjVk_intermediate);
                 const numerator_final = math.subtract(pqTerm_final, sum);
                 Vk_new = math.divide(numerator_final, Ybus[k][k]);
             }


         } else if (bus.type === 'PV') {
             // Step 1: Calculate Qk using current estimates of V
             // Qk = -Im[ conj(Vk_old) * (Ykk*Vk_old + sum(Ykj*Vj)) ]
             // Use voltages consistent with the main sum calculation (updated for j<k, old for j>k)
             let sum_for_Q = math.complex(0, 0);
             for (let j = 0; j < numBuses; j++) {
                if (k !== j) {
                     const Vj_to_use = (j < k) ? V[j] : V_prev_iter[j]; // Consistent voltage usage
                     sum_for_Q = math.add(sum_for_Q, math.multiply(Ybus[k][j], Vj_to_use));
                }
             }
             // Use Vk from the START of the iteration here for Q calculation consistency
             const bracketTerm = math.add(math.multiply(Ybus[k][k], Vk_old_iter), sum_for_Q);
             const qkTerm = math.multiply(math.conj(Vk_old_iter), bracketTerm);
             const Qk_calc = -qkTerm.im; // Calculated reactive power

             // Step 2: Calculate Vk using Pk and calculated Qk (similar to PQ bus calculation)
             const conjVk = math.conj(Vk_old_iter); // Use voltage from START of iteration again
             let Vk_intermediate;
             // Handle potential division by zero
              if (math.abs(conjVk) < 1e-9) {
                  console.warn(`Voltaje cercano a cero para barra PV ${k+1}, cálculo podría ser inestable. Estimando con V_target_mag@0deg.`);
                  // Use target magnitude at 0 angle as a fallback guess if voltage is too low
                  Vk_intermediate = math.complex({ r: bus.V_target_mag, phi: 0 });
             } else {
                 const pqTerm = math.divide(math.complex(bus.P_spec, -Qk_calc), conjVk);
                 const numerator = math.subtract(pqTerm, sum); // Use the same 'sum' as calculated earlier
                 Vk_intermediate = math.divide(numerator, Ybus[k][k]);
             }

             // Step 3: Adjust the magnitude to the specified V_target_mag, keeping the calculated phase
             const angle_new = Vk_intermediate.toPolar().phi; // Get phase from calculated intermediate voltage
             Vk_new = math.complex({ r: bus.V_target_mag, phi: angle_new }); // Apply target magnitude

         } else {
             // Handle unknown bus type
             console.error(`Tipo de barra desconocido '${bus.type}' para la barra ${k+1}.`);
             displayError(`Tipo de barra desconocido '${bus.type}' para la barra ${k+1}.`);
             return; // Stop calculation
         }

         // Final sanity check for NaN/Infinity results
         if (!Vk_new || !math.isComplex(Vk_new) || isNaN(Vk_new.re) || isNaN(Vk_new.im) || !isFinite(Vk_new.re) || !isFinite(Vk_new.im)) {
            console.error(`Error: Cálculo resultó en NaN o Infinito para la barra ${k+1}. Verifique las entradas (especialmente Ybus y cargas/generación). Vk_new: ${Vk_new}`);
            displayError(`Error: Cálculo resultó en NaN o Infinito para la barra ${k+1}. Verifique las entradas (especialmente Ybus y cargas/generación).`);
            return; // Stop calculation
         }

        // Update the voltage vector for the current bus
        V[k] = Vk_new;

    } // End of iteration loop (k)

    // Display results
    resultsTableBody.innerHTML = ''; // Clear previous results
    V.forEach((voltage, index) => {
        const polar = voltage.toPolar();
        let mag = polar.r;
        let phase = radToDeg(polar.phi);

        let magStr, phaseStr;

        // Handle potential NaN/Infinity in results for display
        if (isNaN(mag) || !isFinite(mag)) {
            magStr = String(mag); // Display "NaN" or "Infinity"
        } else {
            magStr = mag.toFixed(5);
        }

         if (isNaN(phase) || !isFinite(phase)) {
            phaseStr = String(phase); // Display "NaN" or "Infinity"
        } else {
             // Normalize angle to be within (-180, 180] degrees
            while (phase <= -180) phase += 360;
            while (phase > 180) phase -= 360;
            phaseStr = phase.toFixed(5);
        }

        const row = resultsTableBody.insertRow();
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${magStr}</td>
            <td>${phaseStr}</td>
        `;
    });

    convergenceInfo.textContent = `Resultados después de 1 iteración.`; // Update status message
    console.log("Cálculo completado después de 1 iteración.");

    // Log final voltages to console for debugging
    console.log("Final V:", V.map(v => {
         const p = v.toPolar();
         return {mag: isNaN(p.r)?'NaN':p.r.toFixed(5), deg: isNaN(p.phi)?'NaN':radToDeg(p.phi).toFixed(5)};
        }));

}

function handleNumBusesChange() {
    generateYbusGrid(); // Regenerate Ybus grid when number of buses changes
    generateBusCards(); // Regenerate bus data cards
}

// Event Listeners
numBusesInput.addEventListener('change', handleNumBusesChange);
runButton.addEventListener('click', runGaussSeidel);

// Initial setup on page load
handleNumBusesChange(); // Generate initial grid and cards based on default value