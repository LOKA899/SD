
const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


async function getOngoingSouldraws() {
    try {
        const [rows] = await db.query('SELECT * FROM souldraws WHERE endTime > ? AND drawMode != ?', [Date.now(), 'cancelled']);
        return rows;
    } catch (error) {
        console.error('Error fetching ongoing souldraws:', error);
        throw error; // Re-throw the error to be handled elsewhere
    }
}

async function updateSouldrawParticipants(souldrawId, participants) {
    try {
        await db.query('UPDATE souldraws SET participants = ? WHERE id = ?', [JSON.stringify(participants), souldrawId]);
    } catch (error) {
        console.error('Error updating souldraw participants:', error);
        throw error;
    }
}

async function updateSouldrawStatus(souldrawId, status) {
    try {
        await db.query('UPDATE souldraws SET drawMode = ? WHERE id = ?', [status, souldrawId]);
    } catch (error) {
        console.error('Error updating souldraw status:', error);
        throw error;
    }
}


module.exports = { db, getOngoingSouldraws, updateSouldrawParticipants, updateSouldrawStatus };
