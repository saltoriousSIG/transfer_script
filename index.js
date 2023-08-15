const { ImmutableX, Config } = require("@imtbl/core-sdk");
const { InfuraProvider } = require("@ethersproject/providers");
const { Wallet } = require("@ethersproject/wallet");
const axios = require("axios");
require("dotenv").config();
const prompt = require("prompt");

prompt.start();

const config = Config.PRODUCTION;
const client = new ImmutableX(config);
const starkPrivateKey = generateStarkPrivateKey(); // Or retrieve previously generated key
const starkSigner = createStarkSigner(starkPrivateKey);
const provider = new InfuraProvider(
  "mainnet",
  process.env.INFURA_API_KEY
);

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

    const allTransfers = transfers.map(async (transfer) => {
      const {
        transaction_id,
        receiver,
        token: { data, type },
      } = transfer;
      const { token_id, id, token_address } = data;
      if (
        receiver.toLowerCase() ===
        "0xd29fc529ca21137c108617e3cdf03c382c1b7aa8".toLowerCase()
      ) {
        const payload = {
          type: "ERC721",
          tokenId: token_id,
          tokenAddress: token_address,
          receiver: result.kerms_new_wallet,
        };
        try {
          return await client.transfer({ signer, starkSigner }, payload);
        } catch (e) {
          return e.message;
        }
      }
      return {};
    });

    const result = await Promise.allSettled(allTransfers);

    console.log(result);
  }
);
