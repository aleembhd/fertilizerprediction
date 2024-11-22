const DEBUG = true; // Set to false in production

function logDebug(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}

function getCurrentDate() {
    const date = new Date();
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric'
    };
    return date.toLocaleDateString('en-IN', options);
}

// Set current date when page loads
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('currentDate').textContent = getCurrentDate();
});

const form = document.getElementById('fertilizerForm');
const submitButton = form.querySelector('button[type="submit"]');
const recommendationsDiv = document.getElementById('recommendations');
const errorDiv = document.getElementById('error');

// Show/hide soil test details
document.querySelector('[name="soilTestAvailable"]').addEventListener('change', (e) => {
    const soilTestDetails = document.getElementById('soilTestDetails');
    soilTestDetails.style.display = e.target.value === 'yes' ? 'block' : 'none';
});

// Handle form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitButton.disabled = true;
    submitButton.innerHTML = `
        <div class="loading">
            <svg class="spinner" width="20" height="20" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Getting Recommendations...
        </div>
    `;
    recommendationsDiv.style.display = 'none';
    errorDiv.style.display = 'none';

    try {
        const formData = Object.fromEntries(new FormData(form));
        
        // Simplified prompt format for more reliable responses
        const prompt = `Generate 4 fertilizer recommendations for:
Crop: ${formData.cropType}
Area: ${formData.fieldArea} ${formData.areaUnit}
Soil Test: ${formData.soilTestAvailable}
${formData.soilTestAvailable === 'yes' ? `
N: ${formData.nitrogenLevel}
P: ${formData.phosphorusLevel}
K: ${formData.potassiumLevel}` : ''}
Irrigation: ${formData.irrigationSource}
Stage: ${formData.cropStage}
Budget: ₹${formData.budget}

Return a JSON object with this exact structure:
{
    "recommendations": [
        {
            "fertilizer": "Name in English (తెలుగు పేరు)",
            "quantity": "Amount per ${formData.areaUnit}",
            "method": "How to apply", 
            "timing": "When to apply",
            "cost": "Cost in ₹",
            "subsidy": {
                "percentage": "Subsidy percentage",
                "maxAmount": "Maximum subsidy amount in ₹",
                "eligibility": "Farmer eligibility criteria",
                "scheme": "Government scheme name",
                "documents": "Required documents for claiming"
            }
        }
    ],
    "organic_alternatives": [
        {
            "name": "Name in English (తెలుగు పేరు)",
            "details": "How to use and benefits"
        }
    ]
}`;

        // Updated API request
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=AIzaSyBwBmRjUaEbb6Mv5yDDDTWoe_5UPjeZ2bc`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        
        // More robust response parsing
        let aiResponse;
        try {
            const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            logDebug('Raw API response:', responseText);
            
            // Clean and parse the response
            const cleanedResponse = responseText
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .trim();
            
            // Find JSON object in the response
            const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON object found in response');
            }
            
            aiResponse = JSON.parse(jsonMatch[0]);
            
            // Validate response structure
            if (!aiResponse.recommendations?.length || aiResponse.recommendations.length === 0) {
                throw new Error('No recommendations received from API');
            }

            // Ensure we have exactly 4 recommendations
            if (aiResponse.recommendations.length < 4) {
                throw new Error('Insufficient recommendations received');
            }

            // Validate each recommendation has required fields
            aiResponse.recommendations.forEach((rec, index) => {
                const required = ['fertilizer', 'quantity', 'method', 'timing', 'cost'];
                const missing = required.filter(field => !rec[field]);
                if (missing.length > 0) {
                    throw new Error(`Recommendation ${index + 1} missing required fields: ${missing.join(', ')}`);
                }
            });

        } catch (parseError) {
            logDebug('Parse error:', parseError);
            throw new Error(`Failed to parse recommendations: ${parseError.message}`);
        }

        // Display recommendations
        if (aiResponse?.recommendations?.length) {
            recommendationsDiv.innerHTML = `
                <div class="recommendations">
                    <h3 class="recommendations-title">🌱 Fertilizer Recommendations 🌾</h3>
                    
                    <div class="recommendations-grid">
                        ${aiResponse.recommendations.map((rec, index) => `
                            <div class="recommendation-card" onclick="triggerConfetti()">
                                <div class="recommendation-content">
                                    <span class="recommendation-number">${index + 1}</span>
                                    <div>
                                        <p class="crop-name">${rec.fertilizer}</p>
                                        <p class="suitability">Quantity: ${rec.quantity}</p>
                                        <p class="growing-info">Method: ${rec.method}</p>
                                        <p class="growing-info">Timing: ${rec.timing}</p>
                                        <p class="growing-info">Cost: ₹${rec.cost}</p>
                                        ${rec.subsidy ? `
                                            <div class="subsidy-info">
                                                <p>Subsidy Details:</p>
                                                <ul>
                                                    <li>Percentage: ${rec.subsidy.percentage}</li>
                                                    <li>Maximum Amount: ₹${rec.subsidy.maxAmount}</li>
                                                    <li>Eligibility: ${rec.subsidy.eligibility}</li>
                                                    <li>Scheme: ${rec.subsidy.scheme}</li>
                                                    <li>Required Documents: ${rec.subsidy.documents}</li>
                                                </ul>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    ${aiResponse.organic_alternatives?.length ? `
                        <div class="organic-alternatives">
                            <h4>Organic Alternatives</h4>
                            ${aiResponse.organic_alternatives.map(alt => `
                                <div class="organic-option">
                                    <h5>${alt.name}</h5>
                                    <p>${alt.details}</p>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
            recommendationsDiv.style.display = 'block';
        } else {
            throw new Error('No recommendations received');
        }
    } catch (error) {
        logDebug('Error details:', error);
        errorDiv.innerHTML = `
            <div class="error">
                <h3 class="error-title">❌ Error ❌</h3>
                <p class="error-message">Failed to get recommendations. Please try again.</p>
                ${DEBUG ? `<p class="error-details">${error.message}</p>` : ''}
            </div>
        `;
        errorDiv.style.display = 'block';
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = 'Get Recommendations';
    }
});

// Confetti animation function
function triggerConfetti() {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
} 