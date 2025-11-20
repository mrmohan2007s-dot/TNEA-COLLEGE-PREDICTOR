// Global variable to store departments
let allDepartments = [];
let allCollegesData = [];
let liveNewsData = null;

// Load departments from server on page load
document.addEventListener('DOMContentLoaded', async function() {
    await loadDepartments();
});

async function loadDepartments() {
    try {
        console.log("Loading departments...");
        const response = await fetch('/api/departments');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.departments && data.departments.length > 0) {
            allDepartments = data.departments;
            const deptSelect = document.getElementById('department');
            
            // Clear existing options except the first one
            deptSelect.innerHTML = '<option value="">Any Department</option>';
            
            // Add departments to dropdown
            allDepartments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept;
                option.textContent = dept;
                deptSelect.appendChild(option);
            });
            console.log("Departments loaded successfully:", allDepartments.length);
        } else if (data.error) {
            console.error("Server error:", data.error);
            await loadDepartmentsFallback();
        } else {
            console.error("No departments received from server");
            await loadDepartmentsFallback();
        }
    } catch (error) {
        console.error('Error loading departments:', error);
        // Fallback: try to load departments directly from cutoff.json
        await loadDepartmentsFallback();
    }
}

async function loadDepartmentsFallback() {
    try {
        const response = await fetch('/static/cutoff.json');
        const data = await response.json();
        allCollegesData = data;
        
        const departments = [...new Set(data.map(item => item.Department))].sort();
        const deptSelect = document.getElementById('department');
        
        deptSelect.innerHTML = '<option value="">Any Department</option>';
        departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            deptSelect.appendChild(option);
        });
        console.log("Departments loaded via fallback:", departments.length);
    } catch (error) {
        console.error('Fallback department loading failed:', error);
        // Last resort: add some common departments manually
        const commonDepts = [
            "COMPUTER SCIENCE AND ENGINEERING",
            "ELECTRONICS AND COMMUNICATION ENGINEERING", 
            "MECHANICAL ENGINEERING",
            "CIVIL ENGINEERING",
            "ELECTRICAL AND ELECTRONICS ENGINEERING"
        ];
        const deptSelect = document.getElementById('department');
        deptSelect.innerHTML = '<option value="">Any Department</option>';
        commonDepts.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            deptSelect.appendChild(option);
        });
    }
}

async function predict() {
    const mark = parseFloat(document.getElementById("mark").value);
    const caste = document.getElementById("caste").value.trim().toUpperCase();
    const dept = document.getElementById("department").value.trim().toUpperCase();
    const code = document.getElementById("code").value.trim();

    if (isNaN(mark) || mark < 0 || mark > 200) {
        alert("Please enter a valid mark between 0 and 200.");
        return;
    }

    // Show loading state
    document.getElementById("results").innerHTML = '<div class="loading">Loading colleges and analyzing current TNEA trends...</div>';
    document.getElementById("recommendation-section").classList.add("hidden");

    try {
        const response = await fetch("/static/cutoff.json");
        const data = await response.json();
        allCollegesData = data;

        // Filter colleges within ±10 marks range
        const filteredResults = data.filter(item => {
            const cutoff = item[caste];
            // Handle null/undefined cutoff values
            if (cutoff === null || cutoff === undefined) return false;
            
            // Include colleges within ±10 marks range
            const inRange = cutoff >= (mark - 10) && cutoff <= (mark + 10);
            const deptMatch = dept ? item.Department?.toUpperCase() === dept : true;
            const codeMatch = code ? item["Counselling Code"]?.toString() === code : true;
            
            return inRange && deptMatch && codeMatch;
        });

        // Sort by cutoff marks (HIGHEST first)
        filteredResults.sort((a, b) => (b[caste] || 0) - (a[caste] || 0));

        // Get live TNEA analysis from Gemini
        liveNewsData = await getLiveTNEAAnalysis(mark, caste, dept, filteredResults.length);

        displayResults(filteredResults, caste, mark);
        if (filteredResults.length > 0) {
            await generateAIRecommendation(filteredResults, mark, caste, dept);
        } else {
            document.getElementById("recommendation-section").classList.add("hidden");
        }
    } catch (error) {
        console.error("Error loading data:", error);
        document.getElementById("results").innerHTML = '<div class="error">Error loading college data. Please try again.</div>';
    }
}

// Get live TNEA analysis from Gemini AI
async function getLiveTNEAAnalysis(mark, caste, dept, collegeCount) {
    const prompt = `
Analyze CURRENT TNEA 2025 trends and provide real-time insights for counselling.

STUDENT PROFILE:
- Marks: ${mark}/200
- Category: ${caste}
- Preferred Department: ${dept || "Any"}
- Colleges Found: ${collegeCount} in range ${mark-10} to ${mark+10}

Provide CURRENT 2025 analysis in this EXACT JSON format:
{
    "analysisDate": "current date",
    "paperDifficulty": "easy/moderate/difficult",
    "expectedCutoffChange": "specific points or percentage",
    "overallTrend": "increasing/stable/decreasing",
    "keyFactors": ["factor1", "factor2", "factor3"],
    "latestNews": ["news1", "news2", "news3"],
    "casteSpecificTrend": "trend for ${caste} category",
    "departmentTrend": "trend for ${dept || "engineering"} departments",
    "strategicAdvice": "specific advice for this student",
    "riskAssessment": "low/medium/high"
}

Base your analysis on:
1. Current TNEA 2025 trends and paper patterns
2. Historical cutoff data patterns
3. Recent education policy changes in Tamil Nadu
4. Engineering admission trends in South India
5. Industry demand for different engineering branches

Be specific and data-driven in your analysis.
`;

    try {
        const response = await fetch("/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();
        
        if (data.response) {
            // Parse the JSON response from Gemini
            try {
                // Extract JSON from the response (Gemini might add some text around JSON)
                const jsonMatch = data.response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                } else {
                    console.error("Could not parse JSON from Gemini response");
                    return getDefaultNews();
                }
            } catch (parseError) {
                console.error("Error parsing Gemini response:", parseError);
                return getDefaultNews();
            }
        } else {
            return getDefaultNews();
        }
    } catch (error) {
        console.error("Error getting live analysis:", error);
        return getDefaultNews();
    }
}

function getDefaultNews() {
    return {
        "analysisDate": new Date().toISOString().split('T')[0],
        "paperDifficulty": "moderate",
        "expectedCutoffChange": "±1-2 points",
        "overallTrend": "stable",
        "keyFactors": [
            "Similar question pattern to previous years",
            "Stable student participation rates",
            "Consistent seat matrix across colleges"
        ],
        "latestNews": [
            "TNEA 2025 counselling schedule expected soon",
            "Cutoff trends similar to previous year patterns",
            "Focus on accredited colleges for better placements"
        ],
        "casteSpecificTrend": "stable with minor fluctuations",
        "departmentTrend": "computer science remains most competitive",
        "strategicAdvice": "Follow standard TNEA counselling strategy with balanced choices",
        "riskAssessment": "medium"
    };
}

function displayResults(results, caste, mark) {
    const div = document.getElementById("results");
    if (results.length === 0) {
        div.innerHTML = "<div class='error'>No matching colleges found in your marks range (±10).</div>";
        return;
    }

    // Calculate adjusted cutoffs based on current trends
    const adjustment = calculateCutoffAdjustment();
    
    div.innerHTML = `
        <div class="mb-4 p-3 bg-blue-50 rounded">
            <strong>Found ${results.length} college(s) within your marks range (${mark-10} - ${mark+10})</strong>
            <p class="text-sm mt-1">Colleges sorted by cutoff marks (highest to lowest) for optimal counselling strategy</p>
            ${liveNewsData ? `
            <div class="mt-2 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                <div class="flex items-center mb-2">
                    <span class="text-lg mr-2">📰</span>
                    <strong class="text-yellow-800">LIVE TNEA 2025 ANALYSIS</strong>
                    <span class="ml-auto text-xs text-yellow-600">${liveNewsData.analysisDate}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div><span class="font-semibold">Paper Difficulty:</span> ${liveNewsData.paperDifficulty.toUpperCase()}</div>
                    <div><span class="font-semibold">Expected Change:</span> ${liveNewsData.expectedCutoffChange}</div>
                    <div><span class="font-semibold">Overall Trend:</span> ${liveNewsData.overallTrend.toUpperCase()}</div>
                    <div><span class="font-semibold">Risk Level:</span> ${liveNewsData.riskAssessment.toUpperCase()}</div>
                </div>
                <div class="mt-2 text-xs text-yellow-700">
                    <strong>Latest:</strong> ${liveNewsData.latestNews[0]}
                </div>
            </div>
            ` : ''}
        </div>
        ${results.slice(0, 20).map(r => {
            const cutoff = r[caste];
            const probability = calculateProbability(mark, cutoff);
            const margin = (mark - cutoff).toFixed(1);
            const adjustedCutoff = getAdjustedCutoff(cutoff, adjustment);
            
            return `
            <div class="card">
                <h3 class="font-bold text-lg">${r.College}</h3>
                <p><strong>Counselling Code:</strong> ${r["Counselling Code"]}</p>
                <p><strong>Department:</strong> ${r.Department}</p>
                <p><strong>${caste} Cutoff (2024):</strong> <span class="highlight">${cutoff}</span></p>
                ${adjustedCutoff !== cutoff ? `
                <p><strong>Expected 2025 Cutoff:</strong> <span class="highlight">${adjustedCutoff.toFixed(1)}</span> 
                <span class="text-sm text-gray-600">(${adjustment > 0 ? '+' : ''}${adjustment} adjustment)</span></p>
                ` : ''}
                <p><strong>Your Marks:</strong> ${mark} | <strong>Margin:</strong> ${margin} points ${mark >= cutoff ? 'above' : 'below'}</p>
                <p><strong>Admission Chance:</strong> ${getAdmissionChanceText(probability)}</p>
                <p><strong>All Cutoffs:</strong> ${['OC','BC','MBC','SC','ST'].map(c => {
                    const val = r[c] !== null && r[c] !== undefined ? r[c] : 'N/A';
                    return `<span class="${c === caste ? 'highlight' : ''}">${c}: ${val}</span>`;
                }).join(' | ')}</p>
            </div>
            `;
        }).join("")}
        ${results.length > 20 ? `<div class="text-center mt-4 p-3 bg-gray-50 rounded">
            <strong>... and ${results.length - 20} more colleges. See complete priority list below.</strong>
        </div>` : ''}
    `;
}

// Calculate cutoff adjustment based on current trends
function calculateCutoffAdjustment() {
    if (!liveNewsData) return 0;
    
    switch (liveNewsData.paperDifficulty) {
        case 'difficult':
            return -2.5; // Cutoffs likely to decrease more
        case 'easy':
            return 3.0; // Cutoffs likely to increase more
        case 'moderate':
            if (liveNewsData.overallTrend === 'increasing') return 1.5;
            if (liveNewsData.overallTrend === 'decreasing') return -1.5;
            return 0.5; // Slight adjustment for moderate
        default:
            return 0;
    }
}

function getAdjustedCutoff(cutoff, adjustment) {
    return Math.max(0, Math.min(200, cutoff + adjustment)); // Ensure cutoff stays within 0-200 range
}

async function generateAIRecommendation(results, mark, caste, dept) {
    // Keep sorting by cutoff marks (highest first) for counselling strategy
    results.sort((a, b) => (b[caste] || 0) - (a[caste] || 0));

    const newsContext = liveNewsData ? `
CURRENT TNEA 2025 REAL-TIME ANALYSIS:
- Analysis Date: ${liveNewsData.analysisDate}
- Paper Difficulty: ${liveNewsData.paperDifficulty}
- Expected Cutoff Change: ${liveNewsData.expectedCutoffChange}
- Overall Trend: ${liveNewsData.overallTrend}
- ${caste} Category Trend: ${liveNewsData.casteSpecificTrend}
- ${dept || "Engineering"} Department Trend: ${liveNewsData.departmentTrend}
- Risk Assessment: ${liveNewsData.riskAssessment}
- Key Factors: ${liveNewsData.keyFactors.join('; ')}
- Latest Updates: ${liveNewsData.latestNews.join('; ')}
- Strategic Advice: ${liveNewsData.strategicAdvice}
` : '';

    // Show more colleges - up to 1000 or all available
    const collegeCount = Math.min(results.length, 1000);
    
    const prompt = `
TNEA 2025 COUNSELLING STRATEGY - REAL-TIME ANALYSIS

STUDENT PROFILE:
- Marks: ${mark}/200
- Category: ${caste}
- Department: ${dept || "Any"}
- Colleges Available: ${collegeCount} in range ${mark-10} to ${mark+10}

${newsContext}

COLLEGE DATA (Sorted by 2024 Cutoff - Highest to Lowest):
${results.slice(0, collegeCount).map((r, index) => 
    `${index + 1}. ${r.College} | Code: ${r["Counselling Code"]} | ${caste} Cutoff: ${r[caste]} | Department: ${r.Department}`
).join('\n')}

REQUIRED ANALYSIS FORMAT:

REAL-TIME 2025 CUTOFF PREDICTIONS:
[Analyze how 2025 cutoffs will differ from 2024 based on current trends]

PRIORITY COLLEGE LIST (Updated for 2025 Trends - Top 1000+ Colleges):

1. College Name | Code: XXXX | Department: [Department Name]
   - 2024 Cutoff: X | Expected 2025: X | Margin: X points
   - 2025 Analysis: [Specific impact of current trends on this college]
   - Counselling Strategy: [When and how to include in choice list]

2. College Name | Code: XXXX | Department: [Department Name]
   - 2024 Cutoff: X | Expected 2025: X | Margin: X points  
   - 2025 Analysis: [Specific impact of current trends on this college]
   - Counselling Strategy: [When and how to include in choice list]

...[Continue for all ${collegeCount} colleges with departments clearly mentioned]...

STRATEGIC COUNSELLING BLUEPRINT 2025:
• Round-by-round strategy based on current trends
• Risk management approach for ${liveNewsData?.riskAssessment} risk scenario
• ${caste}-specific opportunities and challenges
• Department-wise selection strategy
• Timeline recommendations considering 2025 schedule

CRITICAL 2025 FACTORS:
• Impact of ${liveNewsData?.paperDifficulty} paper difficulty
• ${liveNewsData?.overallTrend} trend implications
• Department-wise opportunities
• Backup strategy for uncertainty

Provide comprehensive analysis covering ALL ${collegeCount} colleges with departments clearly specified.
`;

    try {
        document.getElementById("recommendation-output").innerText = `Generating real-time TNEA 2025 counselling strategy for ${collegeCount} colleges...`;
        document.getElementById("recommendation-section").classList.remove("hidden");

        const response = await fetch("/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt })
        });

        const data = await response.json();
        
        if (data.response) {
            document.getElementById("recommendation-output").innerText = data.response;
        } else if (data.error) {
            document.getElementById("recommendation-output").innerText = generateFormalRecommendation(results, mark, caste, dept);
        } else {
            document.getElementById("recommendation-output").innerText = generateFormalRecommendation(results, mark, caste, dept);
        }
    } catch (error) {
        console.error("AI error:", error);
        document.getElementById("recommendation-output").innerText = generateFormalRecommendation(results, mark, caste, dept);
    }
}

// Probability calculation (for information only, not for sorting)
function calculateProbability(studentMark, collegeCutoff) {
    const difference = studentMark - collegeCutoff;
    
    if (difference >= 5) return 95;
    if (difference >= 3) return 85;
    if (difference >= 1) return 75;
    if (difference >= 0) return 65;
    if (difference >= -1) return 45;
    if (difference >= -3) return 30;
    if (difference >= -5) return 20;
    return 10;
}

function getAdmissionChanceText(probability) {
    if (probability >= 80) return "High chance";
    if (probability >= 60) return "Good chance";
    if (probability >= 40) return "Possible";
    if (probability >= 20) return "Low chance";
    return "Very low chance";
}

function getCounsellingAdvice(mark, cutoff, probability) {
    const margin = mark - cutoff;
    
    if (margin >= 5) return "Safe choice - Good backup option";
    if (margin >= 2) return "Reasonable chance - Solid option";
    if (margin >= 0) return "Borderline - Could get seat";
    if (margin >= -2) return "Ambitious - Try in early rounds";
    if (margin >= -5) return "Very ambitious - Low probability";
    return "Extremely ambitious - Last option";
}

function generateFormalRecommendation(results, mark, caste, dept) {
    if (results.length === 0) return "No colleges found in your marks range.\n\nConsider expanding your preferences or checking different departments.";

    const adjustment = calculateCutoffAdjustment();
    const collegeCount = Math.min(results.length, 1000);
    
    let recommendation = `TNEA 2025 COLLEGE PRIORITY LIST\n`;
    recommendation += `==========================================\n\n`;
    recommendation += `Student Profile:\n`;
    recommendation += `• Total Marks: ${mark}/200\n`;
    recommendation += `• Category: ${caste}\n`;
    recommendation += `• Preferred Department: ${dept || "Any"}\n`;
    recommendation += `• Analysis Range: ${mark-10} to ${mark+10}\n`;
    recommendation += `• Colleges Found: ${results.length}\n`;
    recommendation += `• Showing: ${collegeCount} colleges in priority order\n\n`;

    if (liveNewsData) {
        recommendation += `📰 CURRENT TNEA TRENDS\n`;
        recommendation += `------------------------------------------\n`;
        recommendation += `• Paper Difficulty: ${liveNewsData.paperDifficulty.toUpperCase()}\n`;
        recommendation += `• Expected Cutoff Change: ${liveNewsData.expectedCutoffChange}\n`;
        recommendation += `• Overall Trend: ${liveNewsData.overallTrend.toUpperCase()}\n`;
        recommendation += `• Adjustment Applied: ${adjustment > 0 ? '+' : ''}${adjustment} points\n\n`;
        recommendation += `Latest Updates:\n`;
        liveNewsData.latestNews.forEach((news, index) => {
            recommendation += `  ${index + 1}. ${news}\n`;
        });
        recommendation += `\n`;
    }

    recommendation += `PRIORITY LIST (${collegeCount} Colleges - Sorted by Cutoff Marks - Highest to Lowest)\n`;
    recommendation += `==========================================\n\n`;

    // Display all colleges in cutoff order (up to 1000)
    results.slice(0, collegeCount).forEach((college, index) => {
        const cutoff = college[caste];
        const margin = (mark - cutoff).toFixed(1);
        const probability = calculateProbability(mark, cutoff);
        const expectedCutoff = getAdjustedCutoff(cutoff, adjustment);
        
        recommendation += `${index + 1}. ${college.College}\n`;
        recommendation += `   Counselling Code: ${college["Counselling Code"]}\n`;
        recommendation += `   Department: ${college.Department}\n`;
        recommendation += `   2024 Cutoff: ${cutoff} | Expected 2025: ${expectedCutoff.toFixed(1)}\n`;
        recommendation += `   Your Marks: ${mark} | Margin: ${margin} points\n`;
        recommendation += `   Admission Chance: ${getAdmissionChanceText(probability)}\n`;
        recommendation += `   Advice: ${getCounsellingAdvice(mark, cutoff, probability)}\n\n`;
    });

    if (results.length > collegeCount) {
        recommendation += `... and ${results.length - collegeCount} more colleges available.\n\n`;
    }

    recommendation += `2025 CUTOFF PREDICTION ANALYSIS\n`;
    recommendation += `==========================================\n`;
    recommendation += `Based on current trends:\n`;
    recommendation += `• ${liveNewsData?.paperDifficulty === 'difficult' ? 'Cutoffs expected to decrease by 2-3 points due to difficult paper' : 
                     liveNewsData?.paperDifficulty === 'easy' ? 'Cutoffs may increase by 2-3 points due to easier paper' : 
                     'Moderate paper difficulty suggests 1-2 points adjustment'}\n`;
    recommendation += `• ${caste} category may see ${adjustment > 0 ? 'increase' : adjustment < 0 ? 'decrease' : 'stable'} in cutoffs\n`;
    recommendation += `• Computer Science branches likely to remain competitive\n`;
    recommendation += `• Government colleges may see less fluctuation than private ones\n\n`;

    recommendation += `STRATEGIC COUNSELLING RECOMMENDATIONS\n`;
    recommendation += `==========================================\n`;
    recommendation += `1. Higher Cutoff Colleges First: List ambitious options first\n`;
    recommendation += `2. Trend-Based Selection: ${adjustment < 0 ? 'Be more ambitious - cutoffs may drop significantly' : 
                    adjustment > 0 ? 'Be cautious - cutoffs may rise significantly' : 'Follow standard strategy'}\n`;
    recommendation += `3. Early Rounds: Focus on colleges where your marks are close to expected 2025 cutoffs\n`;
    recommendation += `4. Safety Nets: Ensure sufficient safe options considering trend uncertainty\n`;
    recommendation += `5. Department Focus: Prioritize ${dept || "your preferred"} department choices\n`;
    recommendation += `6. Monitoring: Watch for official TNEA announcements on cutoff trends\n\n`;

    recommendation += `Note: These predictions are based on current analysis and may change with official announcements.`;

    return recommendation;
}

function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const content = document.getElementById("recommendation-output").innerText;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - (2 * margin);
    
    // Set title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text("TNEA 2025 COLLEGE PRIORITY LIST", margin, 20);
    
    // Add student info
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const mark = document.getElementById("mark").value;
    const caste = document.getElementById("caste").value;
    const dept = document.getElementById("department").value;
    
    doc.text(`Student Marks: ${mark}/200 | Category: ${caste} | Department: ${dept || "Any"}`, margin, 30);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, margin, 37);
    
    // Add trend info if available
    if (liveNewsData) {
        doc.text(`Current Trend: ${liveNewsData.paperDifficulty.toUpperCase()} paper | Expected: ${liveNewsData.expectedCutoffChange}`, margin, 44);
        doc.text(`Adjustment Applied: ${calculateCutoffAdjustment()} points`, margin, 51);
    }
    
    // Split content into lines
    const lines = doc.splitTextToSize(content, maxWidth);
    
    let yPosition = 60;
    const lineHeight = 5;
    
    // Add content with clean formatting
    doc.setFontSize(8); // Smaller font to fit more content
    lines.forEach(line => {
        if (yPosition > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            yPosition = 20;
        }
        
        // Bold section headers and include departments
        if (line.includes('CURRENT TNEA TRENDS') || line.includes('PRIORITY LIST') || 
            line.includes('CUTOFF PREDICTION') || line.includes('STRATEGIC COUNSELLING') ||
            line.includes('Department:')) {
            doc.setFont(undefined, 'bold');
            doc.setFontSize(9);
        } else {
            doc.setFont(undefined, 'normal');
            doc.setFontSize(8);
        }
        
        // Skip separator lines but ensure departments are shown
        if (!line.includes('===') && !line.includes('---')) {
            doc.text(line, margin, yPosition);
            yPosition += lineHeight;
            
            // Add extra space after college entries to make departments more visible
            if (line.match(/\d+\.\s+.+/)) {
                yPosition += 2;
            }
        }
    });
    
    // Add page numbers
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 25, doc.internal.pageSize.getHeight() - 10);
        doc.text(`Department: ${dept || "All"} | Colleges: ${allCollegesData.length}`, margin, doc.internal.pageSize.getHeight() - 10);
    }
    
    doc.save(`TNEA_Priority_List_${mark}_${caste}_${dept || 'All'}.pdf`);
}