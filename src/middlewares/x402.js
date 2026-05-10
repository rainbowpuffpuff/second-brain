export const x402Middleware = (req, res, next) => {
    const paymentHeader = req.headers['x-payment'];

    // Legacy mock middleware kept for local experiments.
    // The active /api/query route performs on-chain verification in src/routes/api.js.
    if (!paymentHeader) {
        return res.status(402).json({
            error: "Payment Required",
            message: "This endpoint requires an x402 payment.",
            x402_terms: {
                destination_address: "0xb1F7b214c4701478ED89DB478111f082b262b344",
                amount: "0.00001",
                currency: "ETH",
                network: "eip155:4326"
            }
        });
    }

    // Attach payment info to request for potential logging
    req.payment = {
        txHash: paymentHeader
    };

    next();
};
