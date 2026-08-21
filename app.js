document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Square Card Payments
    async function initializeSquarePayments() {
        if (!window.Square) {
            console.error('Square SDK failed to load.');
            return;
        }

        try {
            // Fetch credentials dynamically from your LIVE Render server
            const configResponse = await fetch('https://rpm-qhrz.onrender.com/api/square-config');
            const config = await configResponse.json();

            if (!config.applicationId || !config.locationId) {
                console.error('Failed to load Square credentials from live backend.');
                return;
            }

            const payments = window.Square.payments(config.applicationId, config.locationId);
            const card = await payments.card();
            await card.attach('#card-container');

            const cardButton = document.getElementById('card-button');
            if (cardButton) {
                cardButton.addEventListener('click', async (e) => {
                    e.preventDefault();
                    cardButton.disabled = true;

                    try {
                        const result = await card.tokenize();
                        if (result.status === 'OK') {
                            console.log('Token generated:', result.token);
                            
                            // Send token to live Render server for payment processing
                            const paymentResponse = await fetch('https://rpm-qhrz.onrender.com/api/process-payment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ token: result.token })
                            });

                            const paymentResult = await paymentResponse.json();
                            if (paymentResult.success) {
                                alert('Payment Successful!');
                            } else {
                                alert('Payment Failed: ' + paymentResult.error);
                            }
                        } else {
                            console.error('Tokenization failed:', result.errors);
                        }
                    } catch (error) {
                        console.error('Payment Processing Error:', error);
                    } finally {
                        cardButton.disabled = false;
                    }
                });
            }
        } catch (error) {
            console.error('Initialization Error:', error);
        }
    }

    initializeSquarePayments();
});