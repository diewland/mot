// https://docs.ethers.org/v6/getting-started/
let provider = null;
let signer = null;
let wallet = null;
let contract = null;
let reader = new ethers.Contract(CONTRACT_ADDR, CONTRACT_ABI, new ethers.JsonRpcProvider(CHAIN_RPC));
let raw_chain_id = null;

// main
$('.master .player img').attr('src', PFP_EVO.master);
$('.user .player img').attr('src', PFP_EVO.user);
$('.master .addr').attr('href', CHAIN_EXPLORER + 'address/' + ZERO_ADDR);
$('.user .addr').attr('href', CHAIN_EXPLORER + 'address/' + ZERO_ADDR);
load_master_info();

// enable tooltips
// const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
// const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

// connect button
$('#connect').click(async _ => {
  if (window.ethereum === undefined) {
    alert('Please open by MetaMask browser');
    return;
  }

  // press button effect
  $('#connect').addClass('disabled');

  // connect metamask
  provider = new ethers.BrowserProvider(window.ethereum)
  signer = await provider.getSigner();

  // switch chain
  let changed = await switch_chain();
  if (changed) return;

  console.log('💬', 'connecting wallet..');

  // load player info
  let [addr, name, lv] = await reader.getFunction('getInfo').staticCall(signer.address);
  lv = parseInt(lv);
  update_player('.user', addr, name, lv);

  // toggle panels
  $('#connect-wrapper').addClass('d-none');
  $('#disconnect-wrapper').removeClass('d-none');
});
$('#disconnect').click(_ => {
  $('#connect').removeClass('disabled');
  $('#connect-wrapper').removeClass('d-none');
  $('#disconnect-wrapper').addClass('d-none');
  update_player('.user', ZERO_ADDR, 'Player', 0);
});

// level up
$('#mint').click(async _ => {
  $('#mint').addClass('disabled');
  // recheck chain before mint
  let [ok, msg] = await validate_chain();
  if (!ok) {
    $('#mint').removeClass('disabled');
    alert(msg);
    return;
  }
  // mint
  if (contract === null) contract = new ethers.Contract(CONTRACT_ADDR, CONTRACT_ABI, signer);
  mint_by_gas_rate(contract, MINT_GAS_RATE)
    .then(tx => {
      console.log(tx);
      return tx.wait();
    })
    .then(receipt => { // https://docs.ethers.org/v6/api/providers/#TransactionReceipt
      console.log(receipt);
      if (receipt.status != 1) { // 1 success, 0 revert
        alert(JSON.stringify(receipt.toJSON()));
        $('#mint').removeClass('disabled');
        return;
      }
      play_party_effect();
      level_up_user();
      $('#mint').removeClass('disabled');
    })
    .catch(e => {
      $('#mint').removeClass('disabled');
      alert(e);
    });
});

// rename
$('#rename').click(async _ => {
  $('#rename').addClass('disabled');

  // get username from prompt
  let cur_username = $('.user .username').html();
  let new_username = prompt('Enter username:', cur_username);
  if ((new_username === null) || (new_username == cur_username)) {
    $('#rename').removeClass('disabled');
    return
  }
  new_username = safe_username(new_username);

  // recheck chain before rename
  let [ok, msg] = await validate_chain();
  if (!ok) {
    $('#rename').removeClass('disabled');
    alert(msg);
    return;
  }
  // rename
  if (contract === null) contract = new ethers.Contract(CONTRACT_ADDR, CONTRACT_ABI, signer);
  contract.getFunction('setName').send(new_username)
    .then(tx => {
      console.log(tx);
      return tx.wait();
    })
    .then(receipt => { // https://docs.ethers.org/v6/api/providers/#TransactionReceipt
      console.log(receipt);
      if (receipt.status != 1) { // 1 success, 0 revert
        alert(JSON.stringify(receipt.toJSON()));
        $('#rename').removeClass('disabled');
        return;
      }
      $('.user .username').html(new_username);
      $('#rename').removeClass('disabled');
    })
    .catch(e => {
      $('#rename').removeClass('disabled');
      alert(e);
    });
});

if (window.ethereum) {
  // reconnect when switch account
  window.ethereum.on('accountsChanged', function (accounts) {
    console.log('💬', 'changed account');
    $('#disconnect').click();
    is_chain_ready(_ => $('#connect').click());
  });
  // disconnect when switch chain
  window.ethereum.on('chainChanged', function (networkId) {
    raw_chain_id = networkId;
    console.log('💬', 'changed chain');
    $('#disconnect').click();
    is_chain_ready(_ => $('#connect').click());
  });
}

// web3 functions
function load_master_info() {
  reader.getFunction('getMasterInfo').staticCall().then(info => {
    let [addr, name, lv] = info;
    lv = parseInt(lv);
    update_player('.master', addr, name, lv);
  });
}
function is_chain_ready(callback) {
  let ready = parseInt(raw_chain_id) == CHAIN_ID;
  if (ready && callback) callback();
  return ready;
}
function handle_chain_exception(err) {
  let msg = `Please change network to [${CHAIN_NAME}] before mint.`;
  alert(`${msg}\n\n----- Error Info -----\n[${err.code}] ${err.message}`);
  $('#connect').removeClass('disabled');
}
async function validate_chain() {
  // https://ethereum.stackexchange.com/questions/134610/metamask-detectethereumprovider-check-is-connected-to-specific-chain
  let { chainId } = await provider.getNetwork();
  raw_chain_id = chainId;
  let ok = is_chain_ready();
  let msg = ok ? null : `Please change network to [${CHAIN_NAME}] before mint.`;
  return [ ok, msg ];
}
async function switch_chain() {
  // https://docs.metamask.io/wallet/reference/wallet_addethereumchain/
  let [ok, _] = await validate_chain();
  if (ok) return false;
  // switch chain
  try {
    await window.ethereum.request({
      "method": "wallet_switchEthereumChain",
      "params": [
        {
          "chainId": "0x" + CHAIN_ID.toString(16),
        }
      ]
    });
    return true;
  }
  // if chain not found, add chain
  catch(error) {
    if ([-32603, 4902].includes(error.code)) { // chain not added
      try {
        await window.ethereum.request({
          "method": "wallet_addEthereumChain",
          "params": [
            {
              "chainId": "0x" + CHAIN_ID.toString(16),
              "chainName": CHAIN_NAME,
              "rpcUrls": [
                CHAIN_RPC,
              ],
              //"iconUrls": [
              //  "https://xdaichain.com/fake/example/url/xdai.svg",
              //  "https://xdaichain.com/fake/example/url/xdai.png"
              //],
              "nativeCurrency": {
                "name": CHAIN_SYMBOL,
                "symbol": CHAIN_SYMBOL,
                "decimals": 18
              },
              "blockExplorerUrls": [
                CHAIN_EXPLORER,
              ]
            }
          ]
        });
      }
      catch(error) {
        handle_chain_exception(error);
      }
    }
    else {
      handle_chain_exception(error);
    }
    return true;
  }
}
async function mint_by_gas_rate(contract, gas_rate=1) {
  if (gas_rate == 1) {
    return contract.getFunction('levelUp').send();
  }
  let mint_fn = contract.getFunction('levelUp');
  let params = [];
  let custom = {};
  // gas rate
  let gas_limit = await mint_fn.estimateGas(...params);
  gas_limit = Math.ceil(Number(gas_limit) * gas_rate);
  custom.gasLimit = gas_limit;
  //
  return mint_fn.send(...params, custom);
}
async function load_contract_obj() { // for console use
  provider = new ethers.BrowserProvider(window.ethereum)
  signer = await provider.getSigner();
  let [ok, msg] = await validate_chain();
  if (!ok) { console.warn(msg); return; }
  contract = new ethers.Contract(CONTRACT_ADDR, CONTRACT_ABI, signer);
  console.log('done');
}

// common
function short_addr(addr) {
  return addr.substr(0, 6) + '...' + addr.slice(-4);
}
function play_party_effect() {
  $('#aud')[0].play();
  party.confetti(document.body, {
      count: 120,
      size: 2,
  });
}
function safe_username(name) {
  if (!name) return 'Player';
  return name.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 15);
}

// game
function update_player(sel, addr, name, lv) {
  $(sel + ' .username').html(safe_username(name));
  $(sel + ' .lv').html('Lv ' + lv);
  $(sel + ' .addr')
    .html(short_addr(addr))
    .attr('href', CHAIN_EXPLORER + 'address/' + addr);
  if (sel == '.user') update_pfp(lv);
}
function level_up_user() {
  let new_lv = +$('.user .player .lv').text().split(' ')[1] + 1;
  $('.user .player .lv').html(`Lv ${new_lv}`);
  update_pfp(new_lv);

  // case: you are master
  let master_lv = +$('.master .player .lv').text().split(' ')[1];
  if (master_lv < new_lv) {
    $('.master .username').html($('.user .username').html());
    $('.master .player .lv').html(`Lv ${new_lv}`);
    $('.master .addr')[0].outerHTML = $('.user .addr')[0].outerHTML;
  }
}
function update_pfp(lv) {
  let master_lv = +$('.master .player .lv').text().split(' ')[1];
  if (lv >= master_lv) {
    $('.user .player img').attr('src', PFP_EVO.master);
    return;
  }
  let src = null;
  if (lv >= 1000) { src = PFP_EVO['1000']; }
  else if (lv >= 500) { src = PFP_EVO['500']; }
  else if (lv >= 250) { src = PFP_EVO['250']; }
  else if (lv >= 100) { src = PFP_EVO['100']; }
  else if (lv >= 10) { src = PFP_EVO['10']; }
  else { src = PFP_EVO.user; }
  if (src) $('.user .player img').attr('src', src);
}
