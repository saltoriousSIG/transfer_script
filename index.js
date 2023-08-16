const {
  ImmutableX,
  Config,
  generateLegacyStarkPrivateKey,
} = require("@imtbl/core-sdk");
const {
  generateStarkPrivateKey,
  createStarkSigner,
} = require("@imtbl/core-sdk");
const { InfuraProvider } = require("@ethersproject/providers");
const { Wallet } = require("@ethersproject/wallet");
const axios = require("axios");
require("dotenv").config();
const prompt = require("prompt");

const chunkSize = 100;

prompt.start();

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const config = Config.PRODUCTION;
const client = new ImmutableX(config);

const provider = new InfuraProvider("mainnet", process.env.INFURA_API_KEY);

const generateL2Signer = (l1Signer) => {
  const starkPrivateKey = generateLegacyStarkPrivateKey(l1Signer); // Or retrieve previously generated key
  const starkSigner = createStarkSigner(starkPrivateKey);
  return starkSigner;
};

const getResults = async (cursor, results, walletAddress) => {
  const { data: transfer_data } = await axios.get(
    `https://api.x.immutable.com/v1/transfers?token_type=ERC721&user=${walletAddress}&receiver=0xd29fc529ca21137c108617e3cdf03c382c1b7aa8&cursor=${cursor}`
  );
  const {
    remaining,
    cursor: transfer_cursor,
    result: transfer_results,
  } = transfer_data;
  results.push(transfer_results);
  const res = results.flat();
  if (remaining > 0) {
    return getResults(transfer_cursor, res, walletAddress);
  }
  return res;
};

prompt.get(
  ["sewlies_private_key", "kerms_hacked_wallet", "kerms_new_wallet"],
  async (err, result) => {
    if (err) return;
    const transfers = await getResults("", [], result.kerms_hacked_wallet);
    const signer = new Wallet(result.sewlies_private_key).connect(provider);

    const allTransfers = transfers.map((transfer) => {
      const {
        transaction_id,
        receiver,
        token: { data, type },
      } = transfer;

      const { token_id, id, token_address } = data;
      return {
        receiver: result.kerms_new_wallet,
        tokenId: token_id,
        tokenAddress: token_address,
      };
    });

    const starkSigner = generateL2Signer(signer);

    const walletConnection = {
      ethSigner: signer,
      starkSigner
    }
    
    const completedTransfers = [];

    for (let i = 0; i < allTransfers.length; i += chunkSize) {
      const chunk = allTransfers.slice(i, i + chunkSize);
      const t = await client.batchNftTransfer(walletConnection, chunk)
      console.log(t);
      completedTransfers.push(t);
    }

    console.log(completedTransfers);

  }
);
