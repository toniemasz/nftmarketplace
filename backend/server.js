const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const bcrypt = require('bcryptjs');

const usersPath = path.join(__dirname, 'users.json');
let users = {};
if (fs.existsSync(usersPath)) {
  users = JSON.parse(fs.readFileSync(usersPath));
}

const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
const artifact = {
  abi: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'artifacts', 'contracts_MarketplaceNFT_sol_MarketplaceNFT.abi'))),
  bytecode: fs.readFileSync(path.join(__dirname, '..', 'artifacts', 'contracts_MarketplaceNFT_sol_MarketplaceNFT.bin')).toString()
};

let contractAddress = '';
const contractAddressPath = path.join(__dirname, 'contractAddress.txt');
if (fs.existsSync(contractAddressPath)) {
  contractAddress = fs.readFileSync(contractAddressPath, 'utf8').trim();
}

async function deployContract() {
  const wallet = new ethers.Wallet(users.admin.privateKey, provider);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(wallet.address);
  await contract.waitForDeployment();
  contractAddress = await contract.getAddress();
  fs.writeFileSync(contractAddressPath, contractAddress);
  return contract;
}

let contract;
(async () => {
  if (!contractAddress) {
    contract = await deployContract();
  } else {
    contract = new ethers.Contract(contractAddress, artifact.abi, provider);
  }
})();

const app = express();
app.use(bodyParser.json());
app.use(session({ secret: 'nftsecret', resave: false, saveUninitialized: true }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

function saveUsers() {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (users[username]) return res.status(400).json({ error: 'User exists' });
  const wallet = ethers.Wallet.createRandom();
  const passwordHash = await bcrypt.hash(password, 10);
  users[username] = {
    password: passwordHash,
    address: wallet.address,
    privateKey: wallet.privateKey,
    balance: ethers.parseEther('100').toString(),
    owned: []
  };
  saveUsers();
  res.json({ address: wallet.address });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user) return res.status(400).json({ error: 'Invalid' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: 'Invalid' });
  req.session.user = username;
  res.json({ success: true });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/me', (req, res) => {
  const username = req.session.user;
  if (!username) return res.status(401).json({ error: 'Not logged in' });
  const user = users[username];
  res.json({ username, address: user.address, balance: user.balance, owned: user.owned });
});

app.post('/mint', async (req, res) => {
  const username = req.session.user;
  if (!username) return res.status(401).json({ error: 'Not logged in' });
  const user = users[username];
  const adminWallet = new ethers.Wallet(users.admin.privateKey, provider);
  const contractWithSigner = contract.connect(adminWallet);
  const tx = await contractWithSigner.mint(user.address);
  const receipt = await tx.wait();
  const tokenId = receipt.logs[0].topics[3];
  user.owned.push({ tokenId: tokenId.toString(), forSale: false, price: '0' });
  saveUsers();
  res.json({ tokenId: tokenId.toString() });
});

app.post('/list', async (req, res) => {
  const username = req.session.user;
  if (!username) return res.status(401).json({ error: 'Not logged in' });
  const { tokenId, price } = req.body;
  const user = users[username];
  const nft = user.owned.find(n => n.tokenId === tokenId);
  if (!nft) return res.status(400).json({ error: 'NFT not owned' });
  const wallet = new ethers.Wallet(user.privateKey, provider);
  const contractWithSigner = contract.connect(wallet);
  const tx = await contractWithSigner.listForSale(tokenId, price);
  await tx.wait();
  nft.forSale = true;
  nft.price = price;
  saveUsers();
  res.json({ success: true });
});

app.post('/cancel', async (req, res) => {
  const username = req.session.user;
  if (!username) return res.status(401).json({ error: 'Not logged in' });
  const { tokenId } = req.body;
  const user = users[username];
  const nft = user.owned.find(n => n.tokenId === tokenId);
  if (!nft) return res.status(400).json({ error: 'NFT not owned' });
  const wallet = new ethers.Wallet(user.privateKey, provider);
  const contractWithSigner = contract.connect(wallet);
  const tx = await contractWithSigner.cancelSale(tokenId);
  await tx.wait();
  nft.forSale = false;
  nft.price = '0';
  saveUsers();
  res.json({ success: true });
});

app.get('/market', (req, res) => {
  const items = [];
  for (const [name, user] of Object.entries(users)) {
    user.owned.forEach(nft => {
      if (nft.forSale) {
        items.push({ owner: name, tokenId: nft.tokenId, price: nft.price });
      }
    });
  }
  res.json(items);
});

app.post('/buy', async (req, res) => {
  const username = req.session.user;
  if (!username) return res.status(401).json({ error: 'Not logged in' });
  const { tokenId, seller } = req.body;
  const buyer = users[username];
  const sellerUser = users[seller];
  if (!sellerUser) return res.status(400).json({ error: 'Seller not found' });
  const nft = sellerUser.owned.find(n => n.tokenId === tokenId && n.forSale);
  if (!nft) return res.status(400).json({ error: 'NFT not for sale' });
  const price = nft.price;
  if (BigInt(buyer.balance) < BigInt(price)) return res.status(400).json({ error: 'Insufficient balance' });
  const buyerWallet = new ethers.Wallet(buyer.privateKey, provider);
  const contractWithSigner = contract.connect(buyerWallet);
  const tx = await contractWithSigner.purchase(tokenId, { value: price });
  await tx.wait();
  buyer.balance = (BigInt(buyer.balance) - BigInt(price)).toString();
  sellerUser.balance = (BigInt(sellerUser.balance) + BigInt(price)).toString();
  sellerUser.owned = sellerUser.owned.filter(n => n.tokenId !== tokenId);
  buyer.owned.push({ tokenId, forSale: false, price: '0' });
  saveUsers();
  res.json({ success: true });
});

app.listen(3000, () => console.log('Server on 3000'));

