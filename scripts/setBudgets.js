require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Billing model
const billingSchema = new mongoose.Schema({
    app: { type: String, required: true },
    budget: { type: Number, required: true }
});

const Budgets = mongoose.model('Budgets', billingSchema);

async function connectToMongoDB() {
    const uri = process.env.PRODMONGODB_URI;
    if (!uri) {
        console.error('PRODMONGODB_URI is not set in the environment');
        process.exit(1);
    }

    try {
        await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('MongoDB connected');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
}

async function setBudget() {
    try {
        const app = await new Promise(resolve => {
            rl.question('Enter the app name: ', resolve);
        });

        const budgetAmount = await new Promise(resolve => {
            rl.question('Enter the budget amount: ', resolve);
        });

        const parsedBudget = parseFloat(budgetAmount);

        if (isNaN(parsedBudget)) {
            console.error('Invalid budget amount. Please enter a valid number.');
            return;
        }

        const updatedBudget = await Budgets.findOneAndUpdate(
            { app: app },
            { $set: { budget: parsedBudget } },
            { new: true, upsert: true }
        );

        console.log(`Budget for ${app} set to $${updatedBudget.budget.toFixed(2)}`);
    } catch (error) {
        console.error('Error setting budget:', error);
    }
}

async function listBudgets() {
    try {
        const budgets = await Budgets.find().sort({ app: 1 });
        if (budgets.length === 0) {
            console.log('No budgets found.');
        } else {
            console.log('Current budgets:');
            budgets.forEach(budget => {
                console.log(`${budget.app}: $${budget.budget.toFixed(2)}`);
            });
        }
    } catch (error) {
        console.error('Error listing budgets:', error);
    }
}

async function main() {
    await connectToMongoDB();

    const action = await new Promise(resolve => {
        rl.question('Do you want to (s)et a budget or (l)ist all budgets? ', resolve);
    });

    if (action.toLowerCase() === 's') {
        await setBudget();
    } else if (action.toLowerCase() === 'l') {
        await listBudgets();
    } else {
        console.log('Invalid option. Please choose "s" to set a budget or "l" to list budgets.');
    }

    rl.close();
    await mongoose.connection.close();
}

main();