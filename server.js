const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- VARIABLES DE MEMORIA (Datos iniciales actualizados) ---
let products = [
    { id: 1, name: 'Pollo Broster', category: 'POLLO BROSTER', price: 12.00 },
    { id: 2, name: 'Mostrito', category: 'MOSTRITO', price: 14.00 },
    { id: 3, name: 'Salchipapas', category: 'SALCHIPAPAS', price: 6.00 },
    { id: 4, name: 'El Especial', category: 'ESPECIAL', price: 20.00 },
    { id: 5, name: 'Inka Cola 1L', category: 'BEBIDAS', price: 7.00 }
];

let inventory = [
    { piece: 'Pierna', currentStock: 25, minStock: 5 },
    { piece: 'Pecho', currentStock: 20, minStock: 5 },
    { piece: 'Ala', currentStock: 30, minStock: 5 },
    { piece: 'Cadera', currentStock: 15, minStock: 3 }
];

let orders = [];

// --- RUTAS DE NAVEGACIÓN ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// --- RUTA DE AUTENTICACIÓN ---
app.post('/api/login', (req, res) => {
    const usuario = req.body.usuario || req.body.username;
    const contraseña = req.body.contraseña || req.body.password;

    if (usuario === 'admin' && contraseña === '1234') {
        res.json({ 
            success: true, 
            message: 'Inicio de sesión exitoso',
            user: { name: 'Administrador Principal', role: 'ADMINISTRADOR' }
        });
    } else if (usuario === 'trabajador' && contraseña === '1234') {
        res.json({ 
            success: true, 
            message: 'Inicio de sesión exitoso',
            user: { name: 'Personal de Caja', role: 'TRABAJADOR' }
        });
    } else {
        res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
    }
});

// --- ENDPOINTS DE PRODUCTOS ---
app.get('/api/products', (req, res) => {
    res.json({ success: true, products });
});

app.post('/api/products/add', (req, res) => {
    const { name, category, price } = req.body;
    if (!name || isNaN(price)) return res.json({ success: false, message: 'Datos inválidos' });
    const newProduct = { id: Date.now(), name, category, price: parseFloat(price) };
    products.push(newProduct);
    res.json({ success: true, products });
});

app.post('/api/products/update', (req, res) => {
    const { id, price } = req.body;
    const prod = products.find(p => p.id === id);
    if (prod) {
        prod.price = parseFloat(price);
        res.json({ success: true, products });
    } else {
        res.json({ success: false, message: 'Producto no encontrado' });
    }
});

app.post('/api/products/delete', (req, res) => {
    const { id } = req.body;
    products = products.filter(p => p.id !== id);
    res.json({ success: true, products });
});

// --- ENDPOINTS DE INVENTARIO ---
app.get('/api/inventory', (req, res) => {
    res.json({ success: true, inventory });
});

app.post('/api/inventory/update', (req, res) => {
    const { piece, newStock } = req.body;
    const item = inventory.find(i => i.piece === piece);
    if (item) {
        item.currentStock = parseInt(newStock);
        res.json({ success: true, inventory });
    } else {
        res.json({ success: false, message: 'Pieza no encontrada' });
    }
});

// --- ENDPOINTS DE PEDIDOS ---
app.get('/api/orders', (req, res) => {
    res.json({ success: true, orders });
});

app.post('/api/orders', (req, res) => {
    const { clientName, clientPhone, orderType, observation, items, total } = req.body;
    
    // Validación de stock (Soporta validación robusta para platos dobles)
    for (let item of items) {
        if (item.pieces && Array.isArray(item.pieces)) {
            const pieceCounts = {};
            item.pieces.forEach(p => {
                pieceCounts[p] = (pieceCounts[p] || 0) + item.quantity;
            });

            for (let [pieceName, qtyNeeded] of Object.entries(pieceCounts)) {
                const invItem = inventory.find(i => i.piece.toLowerCase() === pieceName.toLowerCase());
                if (invItem && invItem.currentStock < qtyNeeded) {
                    return res.json({ success: false, message: `Stock insuficiente de la pieza: ${pieceName} (Se necesitan ${qtyNeeded})` });
                }
            }
        } else if (item.piece) {
            const invItem = inventory.find(i => i.piece.toLowerCase() === item.piece.toLowerCase());
            if (invItem && invItem.currentStock < item.quantity) {
                return res.json({ success: false, message: `Stock insuficiente de: ${item.piece}` });
            }
        }
    }

    // Descontar inventario de forma exacta
    for (let item of items) {
        if (item.pieces && Array.isArray(item.pieces)) {
            const pieceCounts = {};
            item.pieces.forEach(p => {
                pieceCounts[p] = (pieceCounts[p] || 0) + item.quantity;
            });

            for (let [pieceName, qtyToSubtract] of Object.entries(pieceCounts)) {
                const invItem = inventory.find(i => i.piece.toLowerCase() === pieceName.toLowerCase());
                if (invItem) invItem.currentStock -= qtyToSubtract;
            }
        } else if (item.piece) {
            const invItem = inventory.find(i => i.piece.toLowerCase() === item.piece.toLowerCase());
            if (invItem) invItem.currentStock -= item.quantity;
        }
    }

    const newOrder = {
        id: Date.now(),
        orderNumber: `PED-${Math.floor(1000 + Math.random() * 9000)}`,
        clientName, clientPhone, orderType, observation, items, total,
        status: '🟡 En Preparación',
        paymentStatus: 'Pendiente',
        paymentMethod: null
    };

    orders.unshift(newOrder);
    res.json({ success: true, order: newOrder });
});

app.post('/api/orders/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    const order = orders.find(o => o.id === parseInt(id));
    if (order) {
        order.status = status;
        res.json({ success: true, order });
    } else {
        res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
});

app.post('/api/orders/:id/pay', (req, res) => {
    const { id } = req.params;
    const { paymentMethod, details } = req.body;
    
    const order = orders.find(o => o.id === parseInt(id));
    if (order) {
        order.paymentStatus = 'Pagado';
        order.paymentMethod = paymentMethod;
        order.paymentDetails = details;
        res.json({ success: true, order });
    } else {
        res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    }
});

// --- INICIAR SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});