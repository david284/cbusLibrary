const expect = require('chai').expect;
var itParam = require('mocha-param');
var winston = require('./config/winston_test.js');

const cbusLib = require('./../cbusLibrary.js')

function decToHex(num, len) {return parseInt(num & (2 ** (4*len) - 1)).toString(16).toUpperCase().padStart(len, '0');}

function stringToHex(string) {
  // expects UTF-8 string
  var bytes = new TextEncoder().encode(string);
  return Array.from(
    bytes,
    byte => byte.toString(16).padStart(2, "0")
  ).join("");
}

function hexToString(hex) {
    // returns UTF-8 string
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i !== bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return new TextDecoder().decode(bytes);
}

// ================================================================================================
//
// As the long message support is quite complex, it's been split into it's own test suite
// Even though it is just one opcode (E9)
//
// ================================================================================================


describe('longMessage tests', function(){


	before(function(done) {
		winston.info({message: ' '});
		winston.info({message: '======================================================================'});
		winston.info({message: '------------------------ long message tests --------------------------'});
		winston.info({message: '======================================================================'});
		winston.info({message: ' '});
        
		done();
	});

	beforeEach(function() {
   		winston.info({message: ' '});   // blank line to separate tests
        // ensure expected CAN header is reset before each test run
        cbusLib.setCanHeader(2, 123)
	});

	after(function() {
   		winston.info({message: ' '});   // blank line to separate tests
	});																										



  // LM_EXCEPTIONS testcases
  //
  function GetTestCase_LM_EXCEPTIONS () {
    var testCases = [];
    for (a1 = 1; a1 < 4; a1++) {
      if (a1 == 1) arg1 = 0, arg2 = "INVALID_VALUE(0)";
      if (a1 == 2) arg1 = 222, arg2 = "UNKNOWN_COMMAND";
      if (a1 == 3) arg1 = 234, arg2 = "UNKNOWN_COMMAND";
      testCases.push({'mnemonic':'LM',
                    'command':arg1,  // Usages command
                    'opCode':'E9',
                    "expected":arg2
      })
    }
    return testCases;
  }

  // LM_EXCEPTIONS
  // invalid & unknown
  //
  itParam(`LM_EXCEPTIONS test}`, 
    GetTestCase_LM_EXCEPTIONS(), function (value) {
    winston.info({message: `UNIT_TEST LM_EXCEPTIONS: BEGIN ${value.mnemonic} : ${JSON.stringify(value)}`});
    winston.info({message: `cbusMessage test: BEGIN LM_EXCEPTIONS`});
    expected = ":SBF60N" + value.opCode + decToHex(value.command,2) + "0000" + "0000" + "0000" + ";";
    var decode = cbusLib.decode(expected);
    winston.info({message: 'UNIT_TEST: LM_INVALID decode ' + JSON.stringify(decode)});
    winston.info({message: 'UNIT_TEST: decode text ' + decode.text});
    expect(decode.encoded).to.equal(expected, 'encoded');
    expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
    expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
    expect(decode.opCode).to.equal(value.opCode, 'opCode');
    expect(decode.command).to.equal(value.expected, 'command');
    winston.info({message: `UNIT_TEST: END LM_EXCEPTIONS`});
  })

  // LM_DATA testcases
  //
  function GetTestCase_LM_DATA () {
    var testCases = [];
    for (a1 = 1; a1 < 3; a1++) {
      if (a1 == 1) arg1 = 1;
      if (a1 == 2) arg1 = 199;
      for (a2 = 1; a2 < 4; a2++) {
        if (a2 == 1) arg2 = 0;
        if (a2 == 2) arg2 = 1;
        if (a2 == 3) arg2 = 255;
        for (a3 = 1; a3 < 4; a3++) {
          if (a3 == 1) arg3 = 0;
          if (a3 == 2) arg3 = 1;
          if (a3 == 3) arg3 = 255;
          for (a4 = 1; a4 < 4; a4++) {
            if (a4 == 1) arg4 = 0;
            if (a4 == 2) arg4 = 1;
            if (a4 == 3) arg4 = 255;
            for (a5 = 1; a5 < 4; a5++) {
              if (a5 == 1) arg5 = 0;
              if (a5 == 2) arg5 = 1;
              if (a5 == 3) arg5 = 255;
              for (a6 = 1; a6 < 4; a6++) {
                if (a6 == 1) arg6 = 0;
                if (a6 == 2) arg6 = 1;
                if (a6 == 3) arg6 = 255;
                for (a7 = 1; a7 < 4; a7++) {
                  if (a7 == 1) arg7 = 0;
                  if (a7 == 2) arg7 = 1;
                  if (a7 == 3) arg7 = 255;
                  testCases.push({'mnemonic':'LM',
                    'command':arg1,  // channel number
                    'opCode':'E9',
                    "Data1": arg2,
                    "Data2": arg3,
                    "Data3": arg4,
                    "Data4": arg5,
                    "Data5": arg6,
                    "Data6": arg7,
                  })
                }
              }
            }
          }
        }
      }
    }
    return testCases;
  }

  // LM_DATA
  // invalid & unknown
  //
  itParam(`LM_DATA test}`, 
    GetTestCase_LM_DATA(), function (value) {
    winston.info({message: `UNIT_TEST: BEGIN ${value.mnemonic} : ${JSON.stringify(value)}`});
    winston.info({message: `UNIT_TEST: BEGIN LM_DATA`});
    expected = ":SAF60N" + value.opCode
      + decToHex(value.command,2) 
      + decToHex(value.Data1,2) 
      + decToHex(value.Data2,2) 
      + decToHex(value.Data3,2) 
      + decToHex(value.Data4,2) 
      + decToHex(value.Data5,2) 
      + decToHex(value.Data6,2) + ";";
    var encode = cbusLib.encodeLM_DATA(value.command, value.Data1, value.Data2, value.Data3, value.Data4, value.Data5, value.Data6)
    var decode = cbusLib.decode(encode);
    winston.info({message: `UNIT_TEST: encode ${encode}` });
    winston.info({message: 'UNIT_TEST: LM_DATA decode ' + JSON.stringify(decode)});
    expect(encode).to.equal(expected, 'encode');
    expect(decode.encoded).to.equal(expected, 'encoded');
    expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
    expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
    expect(decode.opCode).to.equal(value.opCode, 'opCode');
    expect(decode.command).to.equal("DATA", 'command');
    expect(decode.Data1).to.equal(value.Data1, 'Data1');
    expect(decode.Data2).to.equal(value.Data2, 'Data2');
    expect(decode.Data3).to.equal(value.Data3, 'Data3');
    expect(decode.Data4).to.equal(value.Data4, 'Data4');
    expect(decode.Data5).to.equal(value.Data5, 'Data5');
    expect(decode.Data6).to.equal(value.Data6, 'Data6');
    expect(decode.text).to.include(value.mnemonic, 'text mnemonic');
    expect(decode.text).to.include(value.opCode, 'text opCode');
    winston.info({message: `UNIT_TEST: END LM_DATA`});
  })

  // LM_CHANNEL_COMMANDS testcases
  //
  function GetTestCase_LM_CHANNEL_COMMANDS () {
    var testCases = [];
    for (a1 = 1; a1 <= 4; a1++) {
      if (a1 == 1) arg1 = 200, arg3="PROPOSE_CHANNEL";
      if (a1 == 2) arg1 = 201, arg3="INUSE_CHANNEL";
      if (a1 == 3) arg1 = 202, arg3="CLAIM_CHANNEL";
      if (a1 == 4) arg1 = 203, arg3="RELEASE_CHANNEL";
      for (a2 = 1; a2 < 4; a2++) {
        if (a2 == 1) arg2 = 0;
        if (a2 == 2) arg2 = 1;
        if (a2 == 3) arg2 = 199;
        for (a4 = 1; a4 < 4; a4++) {
          if (a4 == 1) arg4 = 0;
          if (a4 == 2) arg4 = 1;
          if (a4 == 3) arg4 = 65535;
          testCases.push({'mnemonic':'LM',
            'command':arg1,
            'opCode':'E9', 
            'channel':arg2,
            'CMD_TXT': arg3,
            'nodeNumber': arg4
          })
        }
      }
    }
    return testCases;
  }
  //
  // EA LM_CHANNEL_COMMANDS
  //
  itParam(`LM_CHANNEL_COMMANDS test`, 
    GetTestCase_LM_CHANNEL_COMMANDS(), function (value) {
    winston.info({message: `UNIT_TEST: LM_CHANNEL_COMMANDS BEGIN ${value.mnemonic} : ${JSON.stringify(value)}`});
    expected = ":SAF60N" + value.opCode
      + decToHex(value.command,2) 
      + decToHex(value.channel,2) 
      + "00"
      + decToHex(value.nodeNumber,4) 
      + "0000" + ";";
    let encode =""
    switch (value.command){
      case 200:
        encode = cbusLib.encodeLM_PROPOSE_CHANNEL(value.channel, value.nodeNumber)
        break;
      case 201:
        encode = cbusLib.encodeLM_INUSE_CHANNEL(value.channel, value.nodeNumber)
        break;
      case 202:
        encode = cbusLib.encodeLM_CLAIM_CHANNEL(value.channel, value.nodeNumber)
        break;
      case 203:
        encode = cbusLib.encodeLM_RELEASE_CHANNEL(value.channel, value.nodeNumber)
        break;
    }
    var decode = cbusLib.decode(encode);
    winston.info({message: `UNIT_TEST: expected ${expected}`});
    winston.info({message: `UNIT_TEST:  encoded ${encode}`});
    winston.info({message: 'UNIT_TEST: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
    expect(encode).to.equal(expected, 'encode');
    expect(decode.encoded).to.equal(expected, 'encoded');
    expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
    expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
    expect(decode.opCode).to.equal(value.opCode, 'opCode');
    expect(decode.command).to.equal(value.CMD_TXT, 'command');
    expect(decode.channel).to.equal(value.channel, 'channel');
    expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
    expect(decode.text).to.include(value.mnemonic, 'text mnemonic');
    expect(decode.text).to.include(value.opCode, 'text opCode');
    winston.info({message: `UNIT_TEST: LM_CHANNEL_COMMANDS END`});
  })

  // LM_REQUEST testcases
  //
  function GetTestCase_LM_REQUEST () {
    var testCases = [];
    for (a1 = 1; a1 < 4; a1++) {
      if (a1 == 1) arg1 = 0;
      if (a1 == 2) arg1 = 1;
      if (a1 == 3) arg1 = 255;
      for (a2 = 1; a2 < 4; a2++) {
        if (a2 == 1) arg2 = 0;
        if (a2 == 2) arg2 = 1;
        if (a2 == 3) arg2 = 255;
        for (a3 = 1; a3 < 4; a3++) {
          if (a3 == 1) arg3 = 0;
          if (a3 == 2) arg3 = 1;
          if (a3 == 3) arg3 = 65535;
          for (a4 = 1; a4 < 4; a4++) {
            if (a4 == 1) arg4 = 0;
            if (a4 == 2) arg4 = 1;
            if (a4 == 3) arg4 = 255;
            testCases.push({'mnemonic':'LM',
                'command':205,  // LM_REQUEST command
                'opCode':'E9', 
                'channel':arg1,
                'use':arg2,
                'nodeNumber':arg3,
                'option_flags':arg4
            })
          }
        }
      }
    }
    return testCases;
  }
  
  // EA LM_REQUEST
  //
  itParam(`LM_REQUEST test`, 
    GetTestCase_LM_REQUEST(), function (value) {
    winston.info({message: `UNIT_TEST: LM_REQUEST BEGIN ${value.mnemonic} : ${JSON.stringify(value)}`});
    expected = ":SAF60N" + value.opCode + decToHex(value.command,2) + decToHex(value.channel,2) + decToHex(value.use,2) + decToHex(value.nodeNumber, 4) + decToHex(value.option_flags,2) + "00" + ";";
    var encode = cbusLib.encodeLM_REQUEST(value.channel, value.use, value.nodeNumber, value.option_flags)
    var decode = cbusLib.decode(encode);
    winston.info({message: `UNIT_TEST: encode ${encode}`});
    winston.info({message: 'UNIT_TEST: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
    expect(encode).to.equal(expected, 'encode');
    expect(decode.encoded).to.equal(expected, 'encoded');
    expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
    expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
    expect(decode.opCode).to.equal(value.opCode, 'opCode');
    expect(decode.command).to.equal("REQUEST", 'command');
    expect(decode.channel).to.equal(value.channel, 'channel');
    expect(decode.use).to.equal(value.use, 'use');
    expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
    expect(decode.option_flags).to.equal(value.option_flags, 'option_flags');
    expect(decode.text).to.include(value.mnemonic, 'text mnemonic');
    expect(decode.text).to.include(value.opCode, 'text opCode');
    winston.info({message: `UNIT_TEST: LM_REQUEST END`});
  })

  // LM_START_MESSAGE testcases
  //
  function GetTestCase_LM_START_MESSAGE () {
    var testCases = [];
    for (a1 = 1; a1 <= 3; a1++) {
      if (a1 == 1) arg1 = 0;
      if (a1 == 2) arg1 = 1;
      if (a1 == 3) arg1 = 199;
      for (a2 = 1; a2 < 4; a2++) {
        if (a2 == 1) arg2 = 0;
        if (a2 == 2) arg2 = 1;
        if (a2 == 3) arg2 = 255;
        for (a3 = 1; a3 < 4; a3++) {
          if (a3 == 1) arg3 = 0;
          if (a3 == 2) arg3 = 1;
          if (a3 == 3) arg3 = 65535;
          for (a4 = 1; a4 < 4; a4++) {
            if (a4 == 1) arg4 = 0;
            if (a4 == 2) arg4 = 1;
            if (a4 == 3) arg4 = 255;
            testCases.push({'mnemonic':'LM',
                'command':210,    // START_MESSAGE
                'opCode':'E9', 
                'channel':arg1,
                'use': arg2,
                'nodeNumber':arg3,
                'option_flags':arg4
            })
            }
        }
      }
    }
    return testCases;
  }
  
  // EA LM_START_MESSAGE (210)
  //
  itParam(`LM_START_MESSAGE test`, 
    GetTestCase_LM_START_MESSAGE(), function (value) {
    winston.info({message: `UNIT_TEST: LM_START_MESSAGE BEGIN ${value.mnemonic} : ${JSON.stringify(value)}`});
    expected = ":SAF60N" 
      + value.opCode 
      + decToHex(value.command,2)      
      + decToHex(value.channel,2) 
      + decToHex(value.use,2) 
      + decToHex(value.nodeNumber,4) 
      + decToHex(value.option_flags,2)
      + "00" + ";";
    winston.info({message: `UNIT_TEST: ${value.mnemonic} expected ${expected}` });
    encode = cbusLib.encodeLM_START_MESSAGE(value.channel, value.use, value.nodeNumber, value.option_flags)
    winston.info({message: `UNIT_TEST: ${value.mnemonic}  encoded ${encode}` });
    var decode = cbusLib.decode(encode);
    winston.info({message: `UNIT_TEST: encode ${encode}`});
    winston.info({message: 'UNIT_TEST: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
    expect(encode).to.equal(expected, 'encode');
    expect(decode.encoded).to.equal(expected, 'encoded');
    expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
    expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
    expect(decode.opCode).to.equal(value.opCode, 'opCode');
    expect(decode.command).to.equal("START_MESSAGE", 'command');
    expect(decode.channel).to.equal(value.channel, 'channel');
    expect(decode.use).to.equal(value.use, 'use');
    expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
    expect(decode.option_flags).to.equal(value.option_flags, 'option_flags');
    expect(decode.text).to.include(value.mnemonic, 'text mnemonic');
    expect(decode.text).to.include(value.opCode, 'text opCode');
    winston.info({message: `UNIT_TEST: LM_START_MESSAGE END`});
  })

  // LM_LAST_DATA1 testcases
  //
  function GetTestCase_LM_LAST_DATA1 () {
    var testCases = [];
    for (a1 = 1; a1 <= 3; a1++) {
      if (a1 == 1) arg1 = 0;
      if (a1 == 2) arg1 = 1;
      if (a1 == 3) arg1 = 199;
      for (a2 = 1; a2 < 4; a2++) {
        if (a2 == 1) arg2 = 0;
        if (a2 == 2) arg2 = 1;
        if (a2 == 3) arg2 = 255;
        testCases.push({'mnemonic':'LM',
          'command':211,
          'opCode':'E9', 
          'channel':arg1,
          'Data1': arg2
        })
      }
    }
    return testCases;
  }
  
  // EA LM_LAST_DATA1
  //
  itParam(`LM_LAST_DATA1 test`, 
    GetTestCase_LM_LAST_DATA1(), function (value) {
    winston.info({message: `UNIT_TEST: LM_LAST_DATA1 BEGIN ${value.mnemonic} : ${JSON.stringify(value)}`});
    expected = ":SAF60N" + value.opCode + decToHex(value.command,2) + decToHex(value.channel,2) + decToHex(value.Data1,2) + "00000000" + ";";
    encode = cbusLib.encodeLM_LAST_DATA1(value.channel, value.Data1)
    var decode = cbusLib.decode(encode);
    winston.info({message: `UNIT_TEST: encode ${encode}`});
    winston.info({message: 'UNIT_TEST: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
    expect(encode).to.equal(expected, 'encode');
    expect(decode.encoded).to.equal(expected, 'encoded');
    expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
    expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
    expect(decode.opCode).to.equal(value.opCode, 'opCode');
    expect(decode.command).to.equal("LAST_DATA1", 'command');
    expect(decode.channel).to.equal(value.channel, 'channel');
    expect(decode.Data1).to.equal(value.Data1, 'Data1');
    expect(decode.text).to.include(value.mnemonic, 'text mnemonic');
    expect(decode.text).to.include(value.opCode, 'text opCode');
    winston.info({message: `UNIT_TEST: LM_LAST_DATA1 END`});
  })

  // LM_LAST_DATA2 testcases
  //
  function GetTestCase_LM_LAST_DATA2 () {
    var testCases = [];
    for (a1 = 1; a1 <= 3; a1++) {
      if (a1 == 1) arg1 = 0;
      if (a1 == 2) arg1 = 1;
      if (a1 == 3) arg1 = 199;
      for (a2 = 1; a2 < 4; a2++) {
        if (a2 == 1) arg2 = 0;
        if (a2 == 2) arg2 = 1;
        if (a2 == 3) arg2 = 255;
        for (a3 = 1; a3 < 4; a3++) {
          if (a3 == 1) arg3 = 0;
          if (a3 == 2) arg3 = 1;
          if (a3 == 3) arg3 = 255;
          testCases.push({'mnemonic':'LM',
            'command':212,
            'opCode':'E9', 
            'channel':arg1,
            'Data1': arg2,
            'Data2': arg3
          })
        }
      }
    }
    return testCases;
  }
  //  
  // EA LM_LAST_DATA2
  //
  itParam(`LM_LAST_DATA2 test`, 
    GetTestCase_LM_LAST_DATA2(), function (value) {
    winston.info({message: `UNIT_TEST: LM_LAST_DATA2 BEGIN ${value.mnemonic} : ${JSON.stringify(value)}`});
    expected = ":SAF60N"
      + value.opCode
      + decToHex(value.command,2)
      + decToHex(value.channel,2) 
      + decToHex(value.Data1,2) 
      + decToHex(value.Data2,2) 
      + "000000" + ";";
    encode = cbusLib.encodeLM_LAST_DATA2(value.channel, value.Data1, value.Data2)
    var decode = cbusLib.decode(encode);
    winston.info({message: `UNIT_TEST: encode ${encode}`});
    winston.info({message: 'UNIT_TEST: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
    expect(encode).to.equal(expected, 'encode');
    expect(decode.encoded).to.equal(expected, 'encoded');
    expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
    expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
    expect(decode.opCode).to.equal(value.opCode, 'opCode');
    expect(decode.command).to.equal("LAST_DATA2", 'command');
    expect(decode.channel).to.equal(value.channel, 'channel');
    expect(decode.Data1).to.equal(value.Data1, 'Data1');
    expect(decode.Data2).to.equal(value.Data2, 'Data2');
    expect(decode.text).to.include(value.mnemonic, 'text mnemonic');
    expect(decode.text).to.include(value.opCode, 'text opCode');
    winston.info({message: `UNIT_TEST: LM_LAST_DATA2 END`});
  })

  // LM_LAST_DATA3 testcases
  //
  function GetTestCase_LM_LAST_DATA3 () {
    var testCases = [];
    for (a1 = 1; a1 <= 3; a1++) {
      if (a1 == 1) arg1 = 0;
      if (a1 == 2) arg1 = 1;
      if (a1 == 3) arg1 = 199;
      for (a2 = 1; a2 < 4; a2++) {
        if (a2 == 1) arg2 = 0;
        if (a2 == 2) arg2 = 1;
        if (a2 == 3) arg2 = 255;
        for (a3 = 1; a3 < 4; a3++) {
          if (a3 == 1) arg3 = 0;
          if (a3 == 2) arg3 = 1;
          if (a3 == 3) arg3 = 255;
          for (a4 = 1; a4 < 4; a4++) {
            if (a4 == 1) arg4 = 0;
            if (a4 == 2) arg4 = 1;
            if (a4 == 3) arg4 = 255;
            testCases.push({'mnemonic':'LM',
              'command':213,
              'opCode':'E9', 
              'channel':arg1,
              'Data1': arg2,
              'Data2': arg3,
              'Data3': arg4
            })
          }
        }
      }
    }
    return testCases;
  }
  
  // EA LM_LAST_DATA3
  //
  itParam(`LM_LAST_DATA3 test`, 
    GetTestCase_LM_LAST_DATA3(), function (value) {
    winston.info({message: `UNIT_TEST: LM_LAST_DATA3 BEGIN ${value.mnemonic} : ${JSON.stringify(value)}`});
    expected = ":SAF60N"
      + value.opCode
      + decToHex(value.command,2)
      + decToHex(value.channel,2) 
      + decToHex(value.Data1,2) 
      + decToHex(value.Data2,2) 
      + decToHex(value.Data3,2) 
      + "0000" + ";";
    encode = cbusLib.encodeLM_LAST_DATA3(value.channel, value.Data1, value.Data2, value.Data3)
    var decode = cbusLib.decode(encode);
    winston.info({message: `UNIT_TEST: encode ${encode}`});
    winston.info({message: 'UNIT_TEST: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
    expect(encode).to.equal(expected, 'encode');
    expect(decode.encoded).to.equal(expected, 'encoded');
    expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
    expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
    expect(decode.opCode).to.equal(value.opCode, 'opCode');
    expect(decode.command).to.equal("LAST_DATA3", 'command');
    expect(decode.channel).to.equal(value.channel, 'channel');
    expect(decode.Data1).to.equal(value.Data1, 'Data1');
    expect(decode.Data2).to.equal(value.Data2, 'Data2');
    expect(decode.Data3).to.equal(value.Data3, 'Data3');
    expect(decode.text).to.include(value.mnemonic, 'text mnemonic');
    expect(decode.text).to.include(value.opCode, 'text opCode');
    winston.info({message: `UNIT_TEST: LM_LAST_DATA3 END`});
  })

  // LM_LAST_DATA4 testcases
  //
  function GetTestCase_LM_LAST_DATA4 () {
    var testCases = [];
    for (a1 = 1; a1 <= 3; a1++) {
      if (a1 == 1) arg1 = 0;
      if (a1 == 2) arg1 = 1;
      if (a1 == 3) arg1 = 199;
      for (a2 = 1; a2 < 4; a2++) {
        if (a2 == 1) arg2 = 0;
        if (a2 == 2) arg2 = 1;
        if (a2 == 3) arg2 = 255;
        for (a3 = 1; a3 < 4; a3++) {
          if (a3 == 1) arg3 = 0;
          if (a3 == 2) arg3 = 1;
          if (a3 == 3) arg3 = 255;
          for (a4 = 1; a4 < 4; a4++) {
            if (a4 == 1) arg4 = 0;
            if (a4 == 2) arg4 = 1;
            if (a4 == 3) arg4 = 255;
            for (a5 = 1; a5 < 4; a5++) {
              if (a5 == 1) arg5 = 0;
              if (a5 == 2) arg5 = 1;
              if (a5 == 3) arg5 = 255;
              testCases.push({'mnemonic':'LM',
                'command':214,
                'opCode':'E9', 
                'channel':arg1,
                'Data1': arg2,
                'Data2': arg3,
                'Data3': arg4,
                'Data4': arg5
              })
            }
          }
        }
      }
    }
    return testCases;
  }
  
  // EA LM_LAST_DATA4
  //
  itParam(`LM_LAST_DATA4 test`, 
    GetTestCase_LM_LAST_DATA4(), function (value) {
    winston.info({message: `UNIT_TEST: LM_LAST_DATA4 BEGIN ${value.mnemonic} : ${JSON.stringify(value)}`});
    expected = ":SAF60N"
      + value.opCode
      + decToHex(value.command,2)
      + decToHex(value.channel,2) 
      + decToHex(value.Data1,2) 
      + decToHex(value.Data2,2) 
      + decToHex(value.Data3,2) 
      + decToHex(value.Data4,2) 
      + "00" + ";";
    encode = cbusLib.encodeLM_LAST_DATA4(value.channel, value.Data1, value.Data2, value.Data3, value.Data4)
    var decode = cbusLib.decode(encode);
    winston.info({message: `UNIT_TEST: encode ${encode}`});
    winston.info({message: 'UNIT_TEST: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
    expect(encode).to.equal(expected, 'encode');
    expect(decode.encoded).to.equal(expected, 'encoded');
    expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
    expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
    expect(decode.opCode).to.equal(value.opCode, 'opCode');
    expect(decode.command).to.equal("LAST_DATA4", 'command');
    expect(decode.channel).to.equal(value.channel, 'channel');
    expect(decode.Data1).to.equal(value.Data1, 'Data1');
    expect(decode.Data2).to.equal(value.Data2, 'Data2');
    expect(decode.Data3).to.equal(value.Data3, 'Data3');
    expect(decode.Data4).to.equal(value.Data4, 'Data4');
    expect(decode.text).to.include(value.mnemonic, 'text mnemonic');
    expect(decode.text).to.include(value.opCode, 'text opCode');
    winston.info({message: `UNIT_TEST: LM_LAST_DATA4 END`});
  })


  // LM_LAST_DATA5 testcases
  //
  function GetTestCase_LM_LAST_DATA5 () {
    var testCases = [];
    for (a1 = 1; a1 <= 3; a1++) {
      if (a1 == 1) arg1 = 0;
      if (a1 == 2) arg1 = 1;
      if (a1 == 3) arg1 = 199;
      for (a2 = 1; a2 < 4; a2++) {
        if (a2 == 1) arg2 = 0;
        if (a2 == 2) arg2 = 1;
        if (a2 == 3) arg2 = 255;
        for (a3 = 1; a3 < 4; a3++) {
          if (a3 == 1) arg3 = 0;
          if (a3 == 2) arg3 = 1;
          if (a3 == 3) arg3 = 255;
          for (a4 = 1; a4 < 4; a4++) {
            if (a4 == 1) arg4 = 0;
            if (a4 == 2) arg4 = 1;
            if (a4 == 3) arg4 = 255;
            for (a5 = 1; a5 < 4; a5++) {
              if (a5 == 1) arg5 = 0;
              if (a5 == 2) arg5 = 1;
              if (a5 == 3) arg5 = 255;
              for (a6 = 1; a6 < 4; a6++) {
                if (a6 == 1) arg6 = 0;
                if (a6 == 2) arg6 = 1;
                if (a6 == 3) arg6 = 255;
                testCases.push({'mnemonic':'LM',
                  'command':215,
                  'opCode':'E9', 
                  'channel':arg1,
                  'Data1': arg2,
                  'Data2': arg3,
                  'Data3': arg4,
                  'Data4': arg5,
                  'Data5': arg6
                })
              }
            }
          }
        }
      }
    }
    return testCases;
  }
  
  // EA LM_LAST_DATA5
  //
  itParam(`LM_LAST_DATA5 test`, 
    GetTestCase_LM_LAST_DATA5(), function (value) {
    winston.info({message: `UNIT_TEST: LM_LAST_DATA5 BEGIN ${value.mnemonic} : ${JSON.stringify(value)}`});
    expected = ":SAF60N"
      + value.opCode
      + decToHex(value.command,2)
      + decToHex(value.channel,2) 
      + decToHex(value.Data1,2) 
      + decToHex(value.Data2,2) 
      + decToHex(value.Data3,2) 
      + decToHex(value.Data4,2) 
      + decToHex(value.Data5,2) + ";";
    encode = cbusLib.encodeLM_LAST_DATA5(value.channel, value.Data1, value.Data2, value.Data3, value.Data4, value.Data5)
    var decode = cbusLib.decode(encode);
    winston.info({message: `UNIT_TEST: encode ${encode}`});
    winston.info({message: 'UNIT_TEST: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
    expect(encode).to.equal(expected, 'encode');
    expect(decode.encoded).to.equal(expected, 'encoded');
    expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
    expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
    expect(decode.opCode).to.equal(value.opCode, 'opCode');
    expect(decode.command).to.equal("LAST_DATA5", 'command');
    expect(decode.channel).to.equal(value.channel, 'channel');
    expect(decode.Data1).to.equal(value.Data1, 'Data1');
    expect(decode.Data2).to.equal(value.Data2, 'Data2');
    expect(decode.Data3).to.equal(value.Data3, 'Data3');
    expect(decode.Data4).to.equal(value.Data4, 'Data4');
    expect(decode.Data5).to.equal(value.Data5, 'Data5');
    expect(decode.text).to.include(value.mnemonic, 'text mnemonic');
    expect(decode.text).to.include(value.opCode, 'text opCode');
    winston.info({message: `UNIT_TEST: LM_LAST_DATA5 END`});
  })

  // LM_END_MESSAGE testcases
  //
  function GetTestCase_LM_END_MESSAGE () {
    var testCases = [];
    for (a1 = 1; a1 <= 3; a1++) {
      if (a1 == 1) arg1 = 0;
      if (a1 == 2) arg1 = 1;
      if (a1 == 3) arg1 = 199;
      for (a2 = 1; a2 < 4; a2++) {
        if (a2 == 1) arg2 = 0;
        if (a2 == 2) arg2 = 1;
        if (a2 == 3) arg2 = 65535;
        testCases.push({'mnemonic':'LM',
          'command':219,    // END_MESSAGE
          'opCode':'E9', 
          'channel':arg1,
          'checksum': arg2
        })
      }
    }
    return testCases;
  }
  
  // EA LM_END_MESSAGE
  //
  itParam(`LM_END_MESSAGE test`, 
    GetTestCase_LM_END_MESSAGE(), function (value) {
    winston.info({message: `UNIT_TEST: LM_END_MESSAGE BEGIN ${value.mnemonic} : ${JSON.stringify(value)}`});
    expected = ":SAF60N" 
      + value.opCode
      + decToHex(value.command,2)      
      + decToHex(value.channel,2) 
      + "00" 
      + decToHex(value.checksum,4)
      + "0000" + ";";
    encode = cbusLib.encodeLM_END_MESSAGE(value.channel, value.checksum)
    var decode = cbusLib.decode(encode);
    winston.info({message: `UNIT_TEST: encode ${encode}`});
    winston.info({message: 'UNIT_TEST: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
    expect(encode).to.equal(expected, 'encode');
    expect(decode.encoded).to.equal(expected, 'encoded');
    expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
    expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
    expect(decode.opCode).to.equal(value.opCode, 'opCode');
    expect(decode.command).to.equal("END_MESSAGE", 'command');
    expect(decode.channel).to.equal(value.channel, 'channel');
    expect(decode.checksum).to.equal(value.checksum, 'checksum');
    expect(decode.text).to.include(value.mnemonic, 'text mnemonic');
    expect(decode.text).to.include(value.opCode, 'text opCode');
    winston.info({message: `UNIT_TEST: LM_END_MESSAGE END`});
  })

  // LM_QUERY testcases
  //
  function GetTestCase_LM_QUERY () {
    var testCases = [];
    for (a1 = 1; a1 < 4; a1++) {
      if (a1 == 1) arg1 = 0;
      if (a1 == 2) arg1 = 1;
      if (a1 == 3) arg1 = 65535;
      testCases.push({'mnemonic':'LM',
                    'command':220,  // query command
                    'opCode':'E9', 
                    'nodeNumber':arg1
      })
    }
    return testCases;
  }
  //
  // EA LM_QUERY
  // sequence 0 test
  //
  itParam(`LM_QUERY test}`, 
    GetTestCase_LM_QUERY(), function (value) {
    winston.info({message: `UNIT_TEST: LM_QUERY BEGIN ${value.mnemonic} : ${JSON.stringify(value)}`});
    expected = ":SAF60N" + value.opCode + decToHex(value.command,2) + "0000" + decToHex(value.nodeNumber, 4) + "0000" + ";";
    var encode = cbusLib.encodeLM_QUERY(value.nodeNumber)
    var decode = cbusLib.decode(encode);
    winston.info({message: `UNIT_TEST: encode ${encode}`});
    winston.info({message: 'UNIT_TEST: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
    expect(encode).to.equal(expected, 'encode');
    expect(decode.encoded).to.equal(expected, 'encoded');
    expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
    expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
    expect(decode.opCode).to.equal(value.opCode, 'opCode');
    expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
    expect(decode.command).to.equal("QUERY", 'command');
    expect(decode.text).to.include(value.mnemonic, 'text mnemonic');
    expect(decode.text).to.include(value.opCode, 'text opCode');
    winston.info({message: `UNIT_TEST: LM_QUERY END`});
  })

  // LM_USAGES testcases
  //
  function GetTestCase_LM_USAGES () {
    var testCases = [];
    for (a1 = 1; a1 < 3; a1++) {
      if (a1 == 1) arg1 = 0;
      if (a1 == 2) arg1 = 1;
      for (a2 = 1; a2 < 4; a2++) {
        if (a2 == 1) arg2 = 0;
        if (a2 == 2) arg2 = 1;
        if (a2 == 3) arg2 = 255;
        for (a3 = 1; a3 < 4; a3++) {
          if (a3 == 1) arg3 = 0;
          if (a3 == 2) arg3 = 1;
          if (a3 == 3) arg3 = 65535;
          for (a4 = 1; a4 < 4; a4++) {
            if (a4 == 1) arg4 = 0;
            if (a4 == 2) arg4 = 1;
            if (a4 == 3) arg4 = 255;
            for (a5 = 1; a5 < 4; a5++) {
              if (a5 == 1) arg5 = 0;
              if (a5 == 2) arg5 = 1;
              if (a5 == 3) arg5 = 255;
              testCases.push({'mnemonic':'LM',
                'command':221,  // Usages command
                'opCode':'E9', 
                'client_server':arg1,
                'use':arg2,
                'nodeNumber':arg3,
                'option_flags':arg4,
                'state':arg5
              })
            }
          }
        }
      }
    }
    return testCases;
  }
  //  
  // EA LM_USAGES
  //
  itParam(`LM_USAGES test}`, 
    GetTestCase_LM_USAGES(), function (value) {
    winston.info({message: `UNIT_TEST: LM_USAGES BEGIN ${value.mnemonic} : ${JSON.stringify(value)}`});
    expected = ":SAF60N" + value.opCode + decToHex(value.command,2)
     + decToHex(value.client_server,2)
     + decToHex(value.use,2) 
     + decToHex(value.nodeNumber, 4) 
     + decToHex(value.option_flags,2)
     + decToHex(value.state,2) + ";";
    var encode = cbusLib.encodeLM_USAGES(value.client_server, value.use, value.nodeNumber, value.option_flags, value.state)
    var decode = cbusLib.decode(encode);
    winston.info({message: `UNIT_TEST: encode ${encode}`});
    winston.info({message: 'UNIT_TEST: ' + value.mnemonic +' decode ' + JSON.stringify(decode)});
    expect(encode).to.equal(expected, 'encode');
    expect(decode.encoded).to.equal(expected, 'encoded');
    expect(decode.ID_TYPE).to.equal('S', 'ID_TYPE');
    expect(decode.mnemonic).to.equal(value.mnemonic, 'mnemonic');
    expect(decode.opCode).to.equal(value.opCode, 'opCode');
    expect(decode.command).to.equal("USAGES", 'command');
    expect(decode.client_server).to.equal(value.client_server, 'client_server');
    expect(decode.use).to.equal(value.use, 'use');
    expect(decode.nodeNumber).to.equal(value.nodeNumber, 'nodeNumber');
    expect(decode.option_flags).to.equal(value.option_flags, 'option_flags');
    expect(decode.state).to.equal(value.state, 'state');
    expect(decode.text).to.include(value.mnemonic, 'text mnemonic');
    expect(decode.text).to.include(value.opCode, 'text opCode');
    winston.info({message: `UNIT_TEST: LM_USAGES END`});
  })



})

