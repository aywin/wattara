// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck -- Legacy experimental page; kept isolated from the typed app surface.
'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Eye, Download, ArrowLeft } from 'lucide-react';

// Données d'exemple (processus recrutement)
const initialSteps = [
  {
    id: '1',
    etape: '1.1',
    tache: 'Identifier besoin de recrutement',
    type: 'SEQ',
    service: 'RH',
    acteur: 'Manager / RH',
    next_yes: '1.2',
    next_no: ''
  },
  {
    id: '2',
    etape: '1.2',
    tache: 'Valider budget',
    type: 'COND',
    service: 'Finance',
    acteur: 'Finance / Manager',
    condition: 'Budget disponible ?',
    next_yes: '1.3',
    next_no: '1.1'
  },
  {
    id: '3',
    etape: '1.3',
    tache: 'Rédiger et publier offre',
    type: 'SEQ',
    service: 'Communication',
    acteur: 'Communication / RH',
    next_yes: '1.4',
    next_no: ''
  },
  {
    id: '4',
    etape: '1.4',
    tache: 'Recevoir candidatures',
    type: 'SEQ',
    service: 'RH',
    acteur: 'RH',
    next_yes: '1.5',
    next_no: ''
  },
  {
    id: '5',
    etape: '1.5',
    tache: 'Trier CV',
    type: 'COND',
    service: 'RH',
    acteur: 'RH',
    condition: 'CV conforme ?',
    next_yes: '1.6',
    next_no: '1.4'
  },
  {
    id: '6',
    etape: '1.6',
    tache: 'Sélectionner candidats',
    type: 'SEQ',
    service: 'Manager',
    acteur: 'Manager / RH',
    next_yes: '1.7',
    next_no: ''
  },
  {
    id: '7',
    etape: '1.7',
    tache: 'Planifier entretiens',
    type: 'SEQ',
    service: 'RH',
    acteur: 'RH / Manager',
    next_yes: '1.8',
    next_no: ''
  },
  {
    id: '8',
    etape: '1.8',
    tache: 'Conduire entretien',
    type: 'SEQ',
    service: 'Manager',
    acteur: 'Manager / RH',
    next_yes: '1.9',
    next_no: ''
  },
  {
    id: '9',
    etape: '1.9',
    tache: 'Évaluer candidat',
    type: 'COND',
    service: 'RH',
    acteur: 'RH / Manager',
    condition: 'Candidat retenu ?',
    next_yes: '1.10',
    next_no: '1.4'
  },
  {
    id: '10',
    etape: '1.10',
    tache: 'Envoyer offre',
    type: 'SEQ',
    service: 'RH',
    acteur: 'RH',
    next_yes: '1.11',
    next_no: ''
  },
  {
    id: '11',
    etape: '1.11',
    tache: 'Accepter ou refuser offre',
    type: 'COND',
    service: 'Candidat',
    acteur: 'Candidat / RH',
    condition: 'Offre acceptée ?',
    next_yes: '1.12',
    next_no: '1.10'
  },
  {
    id: '12',
    etape: '1.12',
    tache: 'Préparer intégration',
    type: 'SEQ',
    service: 'RH',
    acteur: 'RH / IT / Manager',
    next_yes: '',
    next_no: ''
  }
];

// Couleurs par service
const serviceColors = {
  'RH': '#3b82f6',
  'Finance': '#10b981',
  'Communication': '#f59e0b',
  'Manager': '#8b5cf6',
  'IT': '#ef4444',
  'Candidat': '#06b6d4'
};

// Composant pour dessiner une boîte rectangulaire (tâche séquentielle)
const TaskBox = ({ x, y, width, height, step, color }) => {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="white"
        stroke={color}
        strokeWidth="3"
        rx="8"
      />
      <text
        x={x + 10}
        y={y + 20}
        fontSize="11"
        fontWeight="bold"
        fill={color}
      >
        {step.etape}
      </text>
      <text
        x={x + width / 2}
        y={y + height / 2}
        fontSize="13"
        fontWeight="600"
        fill="#1f2937"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {step.tache.length > 25 ? step.tache.substring(0, 25) + '...' : step.tache}
      </text>
      <text
        x={x + width / 2}
        y={y + height - 15}
        fontSize="10"
        fill="#6b7280"
        textAnchor="middle"
      >
        {step.acteur}
      </text>
    </g>
  );
};

// Composant pour dessiner un losange (décision)
const DecisionDiamond = ({ x, y, width, height, step, color }) => {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const points = `${cx},${y} ${x + width},${cy} ${cx},${y + height} ${x},${cy}`;
  
  return (
    <g>
      <polygon
        points={points}
        fill="#fef3c7"
        stroke={color}
        strokeWidth="3"
      />
      <text
        x={cx}
        y={y + 15}
        fontSize="11"
        fontWeight="bold"
        fill={color}
        textAnchor="middle"
      >
        {step.etape}
      </text>
      <text
        x={cx}
        y={cy - 5}
        fontSize="12"
        fontWeight="600"
        fill="#92400e"
        textAnchor="middle"
      >
        {step.tache.length > 20 ? step.tache.substring(0, 20) + '...' : step.tache}
      </text>
      <text
        x={cx}
        y={cy + 15}
        fontSize="10"
        fill="#78716c"
        textAnchor="middle"
        fontStyle="italic"
      >
        {step.condition ? (step.condition.length > 22 ? step.condition.substring(0, 22) + '...' : step.condition) : ''}
      </text>
    </g>
  );
};

// Composant pour dessiner une flèche
const Arrow = ({ x1, y1, x2, y2, label, color, dashed }) => {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const arrowSize = 10;
  
  // Points de la tête de flèche
  const arrowX = x2 - arrowSize * Math.cos(angle);
  const arrowY = y2 - arrowSize * Math.sin(angle);
  const arrowPoint1X = arrowX - arrowSize * Math.cos(angle + Math.PI / 6);
  const arrowPoint1Y = arrowY - arrowSize * Math.sin(angle + Math.PI / 6);
  const arrowPoint2X = arrowX - arrowSize * Math.cos(angle - Math.PI / 6);
  const arrowPoint2Y = arrowY - arrowSize * Math.sin(angle - Math.PI / 6);
  
  // Position du label au milieu
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth="2.5"
        strokeDasharray={dashed ? "8,4" : "none"}
        markerEnd="url(#arrowhead)"
      />
      <polygon
        points={`${x2},${y2} ${arrowPoint1X},${arrowPoint1Y} ${arrowPoint2X},${arrowPoint2Y}`}
        fill={color}
      />
      {label && (
        <>
          <rect
            x={midX - 20}
            y={midY - 12}
            width="40"
            height="20"
            fill="white"
            stroke={color}
            strokeWidth="1.5"
            rx="4"
          />
          <text
            x={midX}
            y={midY + 4}
            fontSize="11"
            fontWeight="bold"
            fill={color}
            textAnchor="middle"
          >
            {label}
          </text>
        </>
      )}
    </g>
  );
};

// Composant principal de génération du workflow SVG
const MEGAWorkflowViewer = ({ steps }) => {
  // Configuration du layout
  const swimlaneHeight = 180;
  const boxWidth = 200;
  const boxHeight = 80;
  const horizontalSpacing = 280;
  const startX = 250;
  const startY = 80;
  
  // Organiser les services (swimlanes)
  const services = [...new Set(steps.map(s => s.service))];
  const swimlaneMap = {};
  services.forEach((service, index) => {
    swimlaneMap[service] = index;
  });
  
  // Calculer les positions de chaque étape
  const positions = {};
  const columnCounters = {};
  
  steps.forEach((step, index) => {
    const swimlaneIndex = swimlaneMap[step.service];
    
    // Compter les colonnes par swimlane
    if (!columnCounters[step.service]) {
      columnCounters[step.service] = 0;
    }
    
    const x = startX + (index * horizontalSpacing);
    const y = startY + (swimlaneIndex * swimlaneHeight);
    
    positions[step.etape] = { x, y, step };
    columnCounters[step.service]++;
  });
  
  // Calculer la taille totale du SVG
  const svgWidth = Math.max(2000, startX + (steps.length * horizontalSpacing) + 200);
  const svgHeight = services.length * swimlaneHeight + 100;
  
  return (
    <div className="w-full overflow-auto border-2 border-gray-300 rounded-lg bg-gray-50">
      <svg width={svgWidth} height={svgHeight}>
        {/* Defs pour les marqueurs */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="currentColor" />
          </marker>
        </defs>
        
        {/* Dessiner les swimlanes (couloirs) */}
        {services.map((service, index) => {
          const y = index * swimlaneHeight;
          const color = serviceColors[service] || '#6b7280';
          const isEven = index % 2 === 0;
          
          return (
            <g key={service}>
              {/* Bande de fond */}
              <rect
                x="0"
                y={y}
                width={svgWidth}
                height={swimlaneHeight}
                fill={isEven ? '#f9fafb' : '#ffffff'}
                stroke="#d1d5db"
                strokeWidth="1"
              />
              
              {/* Label du service (colonne gauche fixe) */}
              <rect
                x="0"
                y={y}
                width="220"
                height={swimlaneHeight}
                fill={color}
                opacity="0.1"
              />
              <rect
                x="10"
                y={y + 10}
                width="200"
                height="40"
                fill={color}
                rx="6"
              />
              <text
                x="110"
                y={y + 35}
                fontSize="16"
                fontWeight="bold"
                fill="white"
                textAnchor="middle"
              >
                {service}
              </text>
            </g>
          );
        })}
        
        {/* Dessiner les flèches (en dessous des boîtes) */}
        {steps.map((step) => {
          const fromPos = positions[step.etape];
          if (!fromPos) return null;
          
          const arrows = [];
          
          // Flèche "Oui" ou suivante
          if (step.next_yes && positions[step.next_yes]) {
            const toPos = positions[step.next_yes];
            const fromX = fromPos.x + boxWidth;
            const fromY = fromPos.y + boxHeight / 2;
            const toX = toPos.x;
            const toY = toPos.y + boxHeight / 2;
            
            arrows.push(
              <Arrow
                key={`${step.etape}-yes`}
                x1={fromX}
                y1={fromY}
                x2={toX}
                y2={toY}
                label={step.type === 'COND' ? 'OUI' : ''}
                color="#10b981"
                dashed={false}
              />
            );
          }
          
          // Flèche "Non" (retour)
          if (step.next_no && positions[step.next_no] && step.type === 'COND') {
            const toPos = positions[step.next_no];
            const fromX = fromPos.x + boxWidth / 2;
            const fromY = fromPos.y + boxHeight;
            const toX = toPos.x + boxWidth / 2;
            const toY = toPos.y;
            
            // Créer une flèche en arc pour les retours
            arrows.push(
              <g key={`${step.etape}-no`}>
                <path
                  d={`M ${fromX} ${fromY} Q ${fromX} ${fromY + 40}, ${toX} ${fromY + 40} Q ${toX} ${fromY + 40}, ${toX} ${toY}`}
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  fill="none"
                  strokeDasharray="8,4"
                />
                <polygon
                  points={`${toX},${toY} ${toX - 6},${toY - 10} ${toX + 6},${toY - 10}`}
                  fill="#ef4444"
                />
                <rect
                  x={fromX - 20}
                  y={fromY + 30}
                  width="40"
                  height="20"
                  fill="white"
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  rx="4"
                />
                <text
                  x={fromX}
                  y={fromY + 44}
                  fontSize="11"
                  fontWeight="bold"
                  fill="#ef4444"
                  textAnchor="middle"
                >
                  NON
                </text>
              </g>
            );
          }
          
          return arrows;
        })}
        
        {/* Dessiner les boîtes et losanges */}
        {steps.map((step) => {
          const pos = positions[step.etape];
          if (!pos) return null;
          
          const color = serviceColors[step.service] || '#6b7280';
          
          if (step.type === 'COND') {
            return (
              <DecisionDiamond
                key={step.etape}
                x={pos.x}
                y={pos.y}
                width={boxWidth}
                height={boxHeight}
                step={step}
                color={color}
              />
            );
          } else {
            return (
              <TaskBox
                key={step.etape}
                x={pos.x}
                y={pos.y}
                width={boxWidth}
                height={boxHeight}
                step={step}
                color={color}
              />
            );
          }
        })}
      </svg>
    </div>
  );
};

export default function WorkflowGenerator() {
  const [steps, setSteps] = useState(initialSteps);
  const [showWorkflow, setShowWorkflow] = useState(false);

  // Ajouter une nouvelle ligne
  const addStep = () => {
    const newId = String(steps.length + 1);
    const newEtape = `1.${steps.length + 1}`;
    setSteps([
      ...steps,
      {
        id: newId,
        etape: newEtape,
        tache: '',
        type: 'SEQ',
        service: 'RH',
        acteur: '',
        next_yes: '',
        next_no: '',
        condition: ''
      }
    ]);
  };

  // Supprimer une ligne
  const deleteStep = (id) => {
    setSteps(steps.filter(step => step.id !== id));
  };

  // Mettre à jour une cellule
  const updateStep = (id, field, value) => {
    setSteps(steps.map(step => 
      step.id === id ? { ...step, [field]: value } : step
    ));
  };

  // Exporter en JSON
  const exportJSON = () => {
    const dataStr = JSON.stringify({ steps }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'workflow-process.json';
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🔄 Générateur de Workflow (Style MEGA Process)
          </h1>
          <p className="text-gray-600 mb-6">
            Modélisation de processus avec swimlanes par service/acteur
          </p>

          {!showWorkflow ? (
            <>
              {/* Tableau éditable */}
              <div className="overflow-x-auto mb-6">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border p-2 text-left font-semibold">ID</th>
                      <th className="border p-2 text-left font-semibold">Étape</th>
                      <th className="border p-2 text-left font-semibold">Tâche</th>
                      <th className="border p-2 text-left font-semibold">Type</th>
                      <th className="border p-2 text-left font-semibold">Service</th>
                      <th className="border p-2 text-left font-semibold">Acteur</th>
                      <th className="border p-2 text-left font-semibold">Condition</th>
                      <th className="border p-2 text-left font-semibold">Si Oui →</th>
                      <th className="border p-2 text-left font-semibold">Si Non →</th>
                      <th className="border p-2 text-left font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {steps.map((step) => (
                      <tr key={step.id} className="hover:bg-gray-50">
                        <td className="border p-2">{step.id}</td>
                        <td className="border p-2">
                          <input
                            type="text"
                            value={step.etape}
                            onChange={(e) => updateStep(step.id, 'etape', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          />
                        </td>
                        <td className="border p-2">
                          <input
                            type="text"
                            value={step.tache}
                            onChange={(e) => updateStep(step.id, 'tache', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                            placeholder="Description de la tâche"
                          />
                        </td>
                        <td className="border p-2">
                          <select
                            value={step.type}
                            onChange={(e) => updateStep(step.id, 'type', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          >
                            <option value="SEQ">SEQ</option>
                            <option value="COND">COND</option>
                          </select>
                        </td>
                        <td className="border p-2">
                          <select
                            value={step.service}
                            onChange={(e) => updateStep(step.id, 'service', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                          >
                            <option value="RH">RH</option>
                            <option value="Finance">Finance</option>
                            <option value="Communication">Communication</option>
                            <option value="Manager">Manager</option>
                            <option value="IT">IT</option>
                            <option value="Candidat">Candidat</option>
                          </select>
                        </td>
                        <td className="border p-2">
                          <input
                            type="text"
                            value={step.acteur}
                            onChange={(e) => updateStep(step.id, 'acteur', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                            placeholder="Qui exécute"
                          />
                        </td>
                        <td className="border p-2">
                          <input
                            type="text"
                            value={step.condition || ''}
                            onChange={(e) => updateStep(step.id, 'condition', e.target.value)}
                            className="w-full px-2 py-1 border rounded text-sm"
                            placeholder="Si type = COND"
                            disabled={step.type !== 'COND'}
                          />
                        </td>
                        <td className="border p-2">
                          <input
                            type="text"
                            value={step.next_yes}
                            onChange={(e) => updateStep(step.id, 'next_yes', e.target.value)}
                            className="w-20 px-2 py-1 border rounded text-sm"
                            placeholder="1.2"
                          />
                        </td>
                        <td className="border p-2">
                          <input
                            type="text"
                            value={step.next_no}
                            onChange={(e) => updateStep(step.id, 'next_no', e.target.value)}
                            className="w-20 px-2 py-1 border rounded text-sm"
                            placeholder="1.1"
                            disabled={step.type !== 'COND'}
                          />
                        </td>
                        <td className="border p-2">
                          <button
                            onClick={() => deleteStep(step.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Boutons d'action */}
              <div className="flex gap-3">
                <button
                  onClick={addStep}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Plus size={20} />
                  Ajouter une étape
                </button>
                <button
                  onClick={() => setShowWorkflow(true)}
                  className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold transition-colors"
                >
                  <Eye size={20} />
                  Générer le Workflow MEGA
                </button>
                <button
                  onClick={exportJSON}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <Download size={20} />
                  Exporter JSON
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Visualisation du workflow */}
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={() => setShowWorkflow(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <ArrowLeft size={20} />
                  Retour au tableau
                </button>
                
                <div className="flex gap-4 items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 bg-green-500"></div>
                    <span className="font-medium">Flux OUI / Suivant</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 bg-red-500" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #ef4444 0, #ef4444 6px, transparent 6px, transparent 10px)' }}></div>
                    <span className="font-medium">Flux NON / Retour</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-8 border-2 border-blue-500 rounded bg-white"></div>
                    <span className="font-medium">Tâche</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-8 border-2 border-yellow-500 bg-yellow-50" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}></div>
                    <span className="font-medium">Décision</span>
                  </div>
                </div>
              </div>

              {/* Légende des services */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                <h3 className="font-bold mb-3">📊 Swimlanes (Couloirs par service) :</h3>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(serviceColors).map(([service, color]) => (
                    <div key={service} className="flex items-center gap-2 px-3 py-1 rounded-lg border-2" style={{ borderColor: color, backgroundColor: `${color}15` }}>
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: color }}></div>
                      <span className="font-semibold text-sm">{service}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Workflow SVG */}
              <MEGAWorkflowViewer steps={steps} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
