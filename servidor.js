// --- COMIENZA EL CÓDIGO COMPLETO Y FINAL DE: servidor.js ---

const express = require('express');
const { createServer } = require('http');
const { Server } = require("socket.io");
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const os = require('os'); // MÓDULO PARA OBTENER INFORMACIÓN DEL SISTEMA OPERATIVO

// --- CONFIGURACIÓN INICIAL ---
const app = express();
app.set('trust proxy', true); // Necesario para obtener la IP correcta si estás detrás de un proxy
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST", "DELETE", "PATCH"] }
});

const port = 3000;
const uri = "mongodb+srv://mercadojesusdavid28:J15832071MO@cluster0.e5dvs.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// --- LÓGICA DE WEBSOCKETS ---
io.on('connection', (socket) => {
  console.log('✅ A user connected:', socket.id);
  socket.on('disconnect', () => { console.log('❌ User disconnected:', socket.id); });
});

// --- RUTAS DE LA API (ENDPOINTS) ---

// OBTENER TODOS LOS MENSAJES (Para el diseño de tarjetas individuales)
app.get('/api/get-messages', async (req, res) => {
    try {
        await client.connect();
        const collection = client.db("portfolioDB").collection("messages");
        const messages = await collection.find({}).sort({ createdAt: -1 }).toArray();
        res.status(200).json(messages);
    } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json([]);
    }
});

// GUARDAR UN NUEVO MENSAJE
app.post('/api/save-message', async (req, res) => {
    try {
        const { email, message, phoneNumber } = req.body;
        const displayName = req.body.name.trim();

        if (!displayName || !email || !message) {
            return res.status(400).json({ message: "Required fields are missing." });
        }

        await client.connect();
        const collection = client.db("portfolioDB").collection("messages");
        
        const userMessage = { 
            name: displayName,
            email, 
            phoneNumber, 
            message, 
            createdAt: new Date(),
            status: "unread",
            adminNotes: "",
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        };
        
        await collection.insertOne(userMessage);
        io.emit('messages_updated');
        res.status(201).json({ message: "Message saved." });
    } catch (error) {
        console.error("Error saving message:", error);
        res.status(500).json({ message: "An error occurred." });
    }
});

// ACTUALIZAR UN MENSAJE
app.patch('/api/update-message/:id', async (req, res) => {
    try {
        const messageId = req.params.id;
        const { status, adminNotes } = req.body;

        if (!ObjectId.isValid(messageId)) {
            return res.status(400).json({ message: "Invalid ID." });
        }

        const fieldsToUpdate = {};
        if (status) fieldsToUpdate.status = status;
        if (adminNotes !== undefined) fieldsToUpdate.adminNotes = adminNotes;

        if (Object.keys(fieldsToUpdate).length === 0) {
            return res.status(400).json({ message: "No fields to update provided." });
        }

        await client.connect();
        const collection = client.db("portfolioDB").collection("messages");
        const result = await collection.updateOne(
            { _id: new ObjectId(messageId) },
            { $set: fieldsToUpdate }
        );

        if (result.matchedCount > 0) {
            io.emit('messages_updated');
            res.status(200).json({ message: "Message updated." });
        } else {
            res.status(404).json({ message: "Message not found." });
        }
    } catch (error) {
        console.error("Error updating message:", error);
        res.status(500).json({ message: "An error occurred." });
    }
});

// BORRAR UN MENSAJE
app.delete('/api/delete-message/:id', async (req, res) => {
    try {
        const messageId = req.params.id;
        if (!ObjectId.isValid(messageId)) return res.status(400).json({ message: "Invalid ID." });
        
        await client.connect();
        const collection = client.db("portfolioDB").collection("messages");
        const result = await collection.deleteOne({ _id: new ObjectId(messageId) });
        
        if (result.deletedCount === 1) {
            io.emit('messages_updated');
            res.status(200).json({ message: "Deleted." });
        } else {
            res.status(404).json({ message: "Not found." });
        }
    } catch (error) {
        console.error("Error deleting message:", error);
        res.status(500).json({ message: "An error occurred." });
    }
});

// --- FUNCIÓN PARA MOSTRAR LAS IPs DE LA RED ---
function showNetworkAddresses() {
    const interfaces = os.networkInterfaces();
    console.log("===============================================================");
    console.log("🚀 SERVER RUNNING! Access your project from other devices: 🚀");
    console.log("===============================================================");
    
    Object.keys(interfaces).forEach(ifaceName => {
        interfaces[ifaceName].forEach(iface => {
            if ('IPv4' !== iface.family || iface.internal !== false) {
                return;
            }
            console.log(`- On ${ifaceName}: http://${iface.address}:${port}`);
        });
    });

    console.log("\nINSTRUCTIONS:");
    console.log("1. Connect your other device (phone, tablet, etc.) to the SAME Wi-Fi network.");
    console.log("2. Find your Wi-Fi IP address in the list above (e.g., 192.168.1.10).");
    console.log("3. In your .html files (index, admin, dashboard), change 'localhost' to that IP address.");
    console.log("   Example: const SERVER_IP = '192.168.1.10';");
    console.log("4. Open the browser on your other device and go to http://<YOUR_IP>:<PORT>/index.html");
    console.log("   (e.g., http://192.168.1.10:3000/index.html)");
    console.log("===============================================================");
}

// --- INICIAR EL SERVIDOR ---
httpServer.listen(port, '0.0.0.0', () => {
    showNetworkAddresses();
});

// --- FIN DEL CÓDIGO DE: servidor.js ---