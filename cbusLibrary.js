'use strict';

/**
* @overview
* <strong>Module to decode & encode CBUS message strings</strong></br>
*/

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//		expects the 'raw' CBUS message in a modified form of the 'Grid connect' CAN over serial message syntax
//
//     : <S | X> <IDENTIFIER> <N> <DATA-0> <DATA-1> … <DATA-7> ;
//
//          The message starts at character position 0, with byte values being two hex characters
//          For CBUS, an 11 bit CAN identifier is used, in 4 hex digits, character positions 2 to 5
//          The CBUS data structure starts at character position 7
//          The CBUS opCode is always character positions 7 & 8
//          Any further CBUS data (dependant on opCode) starts at character character position 9
//          For Extended (29) bit CAN identifier messages, the identifier is 8 hex digits, character positions 2 to 10
//          the modification to standard 'grid connect' is the identifier (11 bit and 29 bit) is formatted to match PIC registers
//          Two 8 bit registers for 11 bit, and four 8 bit registers for 29 bit
//
//      All formats & naming conventions taken from CBUS specification
////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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


/**
*/
class cbusLibrary {
    constructor() {
        this.canHeader = {
                    'MjPri': 2,     // lowest allowed priority (highest value)
                    'CAN_ID': 123,  // allocated by Pete Brownlow to MMC
        }
    }

    //
    // header() provides the prefix to add to CBUS data to compose a transmittable message
    // CAN uses a bitwise arbitration scheme whereby the header with the lowest value has priority
    // So higher values have lower priority
    // It was origianlly believed that The CAN protocol prohibits a sequence of 7 or more 1 bits at the start of the header, so a
    // MjPri. of 11 in binary (3 in decimal) is not used - HOWEVER, this has subsequently been shown not to be the case, so 3 can be used
    //
    header({
                    MjPri = this.canHeader.MjPri,
                    MinPri = 3,
                    CAN_ID = this.canHeader.CAN_ID
        } = {}) {
        // ensure all variables don't exceed the appropriate number of bits for encoding
//        if (MjPri > 2) {MjPri = 2}      // MjPri is two bits, but a value of 3 is not allowed **** no longer true ****
		MjPri = MjPri % 4				// MjPri is two bits, 0 to 3
        MinPri = MinPri % 4             // MinPri is two bits, 0 to 3
        CAN_ID = CAN_ID % 128           // CAN_ID is 7 bits, 0 to 127
		var identifier = parseInt(MjPri << 14) + parseInt(MinPri << 12) + parseInt(CAN_ID << 5) 
        return ':S' + decToHex(identifier, 4) + 'N'
    }

    /**
     * gets the can header
    * @return {String} Returns changeable CAN header parameters as JSON structure
    * @example
    * {
    *   'MjPri': 2,
    *   'CAN_ID': 123,
    * }
    */
    getCanHeader() {
        return this.canHeader
        }
    /**
    * setCanHeader
    * @param {int} MjPri Major priority, two bit number 0 - 3 (3 is allowed, unlike previous assumption)
    * @param {int} CAN_ID 7 bit number, 0 to 127
    */
    setCanHeader(MjPri, CAN_ID) {
        if (MjPri != undefined) { 
        this.canHeader.MjPri = (MjPri > 3) ? 3 : MjPri}                     // MjPri is two bits, but a value of 3 is n0t allowed
        if (CAN_ID != undefined) { this.canHeader.CAN_ID = CAN_ID % 128}    // CAN_ID is 7 bits, 0 to 127
    }


    //
    //
    // Decode / Encode Methods strictly arranged by numerical opcode to ensure that it's easy to spot if a function already exists
    //
    //

    /**
    * @desc Decode a CBUS message<br>
    * This will decode both 11 bit ID CBUS messages and also 29 bit extended messages, as these are identified in the message itself <br>
    * The actual CBUS messsage is expected to be in 'Grid connect' ASCII format, either as a plain string<br>
    * or as the 'encoded' property in a JSON object<br>
    * NOTE: doesn't preserve the original input JSON, but creates new JSON object as output
    * @param {String} message CAN BUS message in a plain string or JSON format ('Grid connect' ASCII)
    * @return {Object} Decoded properties as a JSON structure - content dependant on specific message, 
    * but will always have 'encoded' as the original input message, and also 'ID_TYPE' & 'text' elements<br>
    * 'ID_TYPE' will be either 'S' (11 bit CBUS message) or 'X' (29 bit extended message) - or blank if not valid
    *
    * @example
    *
    * // 11 bit CBUS message
    *    {
    *      "encoded": ":SA780NE1FF00007F01FF01;",
    *      "ID_TYPE":"S",
    *      "mnemonic": "PLOC",
    *      "opCode": "E1",
    *      "session": 255,
    *      "address": 0,
    *      "speed": 127,
    *      "direction": "Reverse",
    *      "Fn1": 1,
    *      "Fn2": 255,
    *      "Fn3": 1,
    *      "text": "PLOC (E1) Session 255 Address 0 Speed/Dir 127 Direction Reverse Fn1 1 Fn2 255 Fn3 1"
    *    }
    *
    * // 29 bit firmware download control message
    *    {
    *       "encoded":":X00080004N000000000D040000;",
    *       "ID_TYPE":"X",
    *       "operation":"PUT",
    *       "type":"CONTROL",
    *       "address":"000000",
    *       "RESVD":0,
    *       "CTLBT":13,
    *       "SPCMD":4,
    *       "CPDTL":0,
    *       "CPDTH":0
    *       "text": {"encoded":":X00080004N000000000D040000;","ID_TYPE":"X","operation":"PUT","type":"CONTROL","address":"000000","RESVD":0,"CTLBT":13,"SPCMD":4,"CPDTL":0,"CPDTH":0}
    *    }
    */
    decode(message) {
      if(message.hasOwnProperty('encoded')) {
          message = message.encoded;
      }
      if (message.length >=2){
        if (( message.substring(1, 2) == 'S' ) & (message.length >=7)) {
          if ((message.substring(6,7) == 'N') & (message.length >=9)) {
            // example :S7020N10;
            return this.decodeStandardMessage(message)
          } else if ((message.substring(6,7) == 'N') & (message.length == 8)) {
            // example :S7020N;
            return this.unDecodedMessage(message, 'S', `Empty message ${message}`)
          } else if (message.substring(6,7) == 'R'){
            // example :S7020R;
            return this.unDecodedMessage(message, 'S', `RTR message ${message}`)
          } else {
            return this.unDecodedMessage(message, '', `unsupported message ${message}`)
          }
        } else if (( message.substring(1, 2) == 'X' ) & (message.length >= 11)) {
          if ((message.substring(10,11) == 'N') & (message.length >= 13)) {
            // example :X00080001N00FFFFFF0101FFFF;
            return this.decodeExtendedMessage(message)
          } else if  ((message.substring(10,11) == 'N') & (message.length == 12)) {
            // example :X00080001N;
            return this.unDecodedMessage(message, 'X', `Empty message ${message}`)
          } else if (message.substring(10,11) == 'R'){
            // example :X00080001R;
            return this.unDecodedMessage(message, 'X', `RTR message ${message}`)
          } else {
            return this.unDecodedMessage(message, '', `unsupported message ${message}`)
          }
        } else {
            return this.unDecodedMessage(message, '', `unsupported message ${message}`)
        }
      } else {
        return this.unDecodedMessage(message, '', `invalid message ${message}`)
      }
    }

    unDecodedMessage(message, ID_TYPE, text){
      return  {'encoded': message,
                'ID_TYPE': ID_TYPE,
                'text': text
      }
    }

    decodeStandardMessage(message) {
       
        if (message == undefined) message = this.message;
        var opCode = message.substr(7, 2);
        switch (opCode) {
        case '00':
            return this.decodeACK(message);
            break;
        case '01':
            return this.decodeNAK(message);
            break;
        case '02':
            return this.decodeHLT(message);
            break;
        case '03':
            return this.decodeBON(message);
            break;
        case '04':
            return this.decodeTOF(message);
            break;
        case '05':
            return this.decodeTON(message);
            break;
        case '06':
            return this.decodeESTOP(message);
            break;
        case '07':
            return this.decodeARST(message);
            break;
        case '08':
            return this.decodeRTOF(message);
            break;
        case '09':
            return this.decodeRTON(message);
            break;
        case '0A':
            return this.decodeRESTP(message);
            break;
        // 0B reserved
        case '0C':
            return this.decodeRSTAT(message);
            break;
        case '0D':
            return this.decodeQNN(message);
            break;
        // 0E, 0F reserved
        case '10':
            return this.decodeRQNP(message);
            break;
        case '11':
            return this.decodeRQMN(message);
            break;
        case '12':
            return this.decodeGSTOP(message);
            break;
        // 13 - 20 reserved
        case '21':
            return this.decodeKLOC(message);
            break;
        case '22':
            return this.decodeQLOC(message);
            break;
        case '23':
            return this.decodeDKEEP(message);
            break;
        // 24 - 2F reserved
        case '30':
            return this.decodeDBG1(message);
            break;
        // 31 - 3E reserved
        case '3F':
            return this.decodeEXTC(message);
            break;
        case '40':
            return this.decodeRLOC(message);
            break;
        case '41':
            return this.decodeQCON(message);
            break;
        case '42':
            return this.decodeSNN(message);
            break;
        case '43':
            return this.decodeALOC(message);
            break;
        case '44':
            return this.decodeSTMOD(message);
            break;
        case '45':
            return this.decodePCON(message);
            break;
        case '46':
            return this.decodeKCON(message);
            break;
        case '47':
            return this.decodeDSPD(message);
            break;
        case '48':
            return this.decodeDFLG(message);
            break;
        case '49':
            return this.decodeDFNON(message);
            break;
        case '4A':
            return this.decodeDFNOF(message);
            break;
        // 4B reserved
        case '4C':
            return this.decodeSSTAT(message);
            break;
        // 4D - 4E reserved
        case '4F':
            return this.decodeNNRSM(message);
            break;
		    case '50':
            return this.decodeRQNN(message);
            break;
		    case '51':
            return this.decodeNNREL(message);
            break;
        case '52':
            return this.decodeNNACK(message);
            break;
        case '53':
            return this.decodeNNLRN(message);
            break;
        case '54':
            return this.decodeNNULN(message);
            break;
        case '55':
            return this.decodeNNCLR(message);
            break;
        case '56':
            return this.decodeNNEVN(message);
            break;
        case '57':
            return this.decodeNERD(message);
            break;
        case '58':
            return this.decodeRQEVN(message);
            break;
        case '59':
            return this.decodeWRACK(message);
            break;
        case '5A':
            return this.decodeRQDAT(message);
            break;
        case '5B':
            return this.decodeRQDDS(message);
            break;
        case '5C':
            return this.decodeBOOTM(message);
            break;
        case '5D':
            return this.decodeENUM(message);
            break;
        case '5E':
            return this.decodeNNRST(message);
            break;
        case '5F':
            return this.decodeEXTC1(message);
            break;
        case '60':
            return this.decodeDFUN(message);
            break;
        case '61':
            return this.decodeGLOC(message);
            break;
        // 62 - reserved
        case '63':
            return this.decodeERR(message);
            break;
        // 64 - 65 reserved
        case '66':
            return this.decodeSQU(message);
            break;
        // 67 - 6E reserved
        case '6F':
            return this.decodeCMDERR(message);
            break;
        case '70':
            return this.decodeEVNLF(message);
            break;
        case '71':
            return this.decodeNVRD(message);
            break;
        case '72':
            return this.decodeNENRD(message);
            break;
        case '73':
            return this.decodeRQNPN(message);
            break;
        case '74':
            return this.decodeNUMEV(message);
            break;
        case '75':
            return this.decodeCANID(message);
            break;
        case '76':
            return this.decodeMODE(message);
            break;
        // 77 reserved
        case '78':
            return this.decodeRQSD(message);
            break;
        // 79 - 7E reserved
        case '7F':
            return this.decodeEXTC2(message);
            break;
        case '80':
            return this.decodeRDCC3(message);
            break;
        // 81 - reserved
        case '82':
            return this.decodeWCVO(message);
            break;
        case '83':
            return this.decodeWCVB(message);
            break;
        case '84':
            return this.decodeQCVS(message);
            break;
        case '85':
            return this.decodePCVS(message);
            break;
        case '87':
            return this.decodeRDGN(message);
            break;
        // 88 - 8E reserved
        case '8E':
            return this.decodeNVSETRD(message);
            break;
        // 8F reserved
        case '90':
            return this.decodeACON(message);
            break;
        case '91':
            return this.decodeACOF(message);
            break;
        case '92':
            return this.decodeAREQ(message);
            break;
        case '93':
            return this.decodeARON(message);
            break;
        case '94':
            return this.decodeAROF(message);
            break;
        case '95':
            return this.decodeEVULN(message);
            break;
        case '96':
            return this.decodeNVSET(message);
            break;
        case '97':
            return this.decodeNVANS(message);
            break;
        case '98':
            return this.decodeASON(message);
            break;
        case '99':
            return this.decodeASOF(message);
            break;
        case '9A':
            return this.decodeASRQ(message);
            break;
        case '9B':
            return this.decodePARAN(message);
            break;
        case '9C':
            return this.decodeREVAL(message);
            break;
        case '9D':
            return this.decodeARSON(message);
            break;
        case '9E':
            return this.decodeARSOF(message);
            break;
        case '9F':
            return this.decodeEXTC3(message);
            break;
        case 'A0':
            return this.decodeRDCC4(message);
            break;
        // A1 - reserved
        case 'A2':
            return this.decodeWCVS(message);
            break;
        // A3 - AA reserved
        case 'AB':
            return this.decodeHEARTB(message);
            break;
        case 'AC':
            return this.decodeSD(message);
            break;
        // AD - AE reserved
        case 'AF':
            return this.decodeGRSP(message);
            break;
        case 'B0':
            return this.decodeACON1(message);
            break;
        case 'B1':
            return this.decodeACOF1(message);
            break;
        case 'B2':
            return this.decodeREQEV(message);
            break;
        case 'B3':
            return this.decodeARON1(message);
            break;
        case 'B4':
            return this.decodeAROF1(message);
            break;
        case 'B5':
            return this.decodeNEVAL(message);
            break;
        case 'B6':
            return this.decodePNN(message);
            break;
        case 'B8':
            return this.decodeASON1(message);
            break;
        case 'B9':
            return this.decodeASOF1(message);
            break;
        // BA - BC reserved
        case 'BD':
            return this.decodeARSON1(message);
            break;
        case 'BE':
            return this.decodeARSOF1(message);
            break;
        case 'BF':
            return this.decodeEXTC4(message);
            break;
        case 'C0':
            return this.decodeRDCC5(message);
            break;
        case 'C1':
            return this.decodeWCVOA(message);
            break;
        case 'C2':
            return this.decodeCABDAT(message);
            break;
        // C3 - C6 reserved
        case 'C7':
            return this.decodeDGN(message);
            break;
        // C8 - CE reserved
        case 'CF':
            return this.decodeFCLK(message);
            break;
        case 'D0':
            return this.decodeACON2(message);
            break;
        case 'D1':
            return this.decodeACOF2(message);
            break;
        case 'D2':
            return this.decodeEVLRN(message);
            break;
        case 'D3':
            return this.decodeEVANS(message);
            break;
        case 'D4':
            return this.decodeARON2(message);
            break;
        case 'D5':
            return this.decodeAROF2(message);
            break;
        // D6 - D7 reserved
        case 'D8':
            return this.decodeASON2(message);
            break;
        case 'D9':
            return this.decodeASOF2(message);
            break;
        // DA - DC reserved
        case 'DD':
            return this.decodeARSON2(message);
            break;
        case 'DE':
            return this.decodeARSOF2(message);
            break;
        case 'DF':
            return this.decodeEXTC5(message);
            break;
        case 'E0':
            return this.decodeRDCC6(message);
            break;
        case 'E1':
            return this.decodePLOC(message);
            break;
        case 'E2':
            return this.decodeNAME(message);
            break;
        case 'E3':
            return this.decodeSTAT(message);
            break;
        // E4 - E5 reserved
        case 'E6':
            return this.decodeENACK(message);
            break;
        case 'E7':
            return this.decodeESD(message);
            break;
        // E8 reserved
        case 'E9':
              return this.decodeDTXC(message);
              break;
        // EA - EE reserved
        case 'EF':
            return this.decodePARAMS(message);
            break;
        case 'F0':
            return this.decodeACON3(message);
            break;
        case 'F1':
            return this.decodeACOF3(message);
            break;
        case 'F2':
            return this.decodeENRSP(message);
            break;
        case 'F3':
            return this.decodeARON3(message);
            break;
        case 'F4':
            return this.decodeAROF3(message);
            break;
        case 'F5':
            return this.decodeEVLRNI(message);
            break;
        case 'F6':
            return this.decodeACDAT(message);
            break;
        case 'F7':
            return this.decodeARDAT(message);
            break;
        case 'F8':
            return this.decodeASON3(message);
            break;
        case 'F9':
            return this.decodeASOF3(message);
            break;
        case 'FA':
            return this.decodeDDES(message);
            break;
        case 'FB':
            return this.decodeDDRS(message);
            break;
        case 'FC':
            return this.decodeDDWS(message);
            break;
        case 'FD':
            return this.decodeARSON3(message);
            break;
        case 'FE':
            return this.decodeARSOF3(message);
            break;
        case 'FF':
            return this.decodeEXTC6(message);
            break;

        default:
            return {'encoded': message, 'ID_TYPE': 'S', 'mnemonic': 'UNSUPPORTED', 'opCode': message.substr(7, 2), 'text': 'UNSUPPORTED (' + message.substr(7, 2) + ')'}
            break;
        }
    }


    decodeExtendedMessage(message) {
        var output = {}
		output['encoded'] = message
		output['ID_TYPE'] = 'X'
        if ((message.length >= 27) & (message.substr(0,9) == ':X0008000')){
            if(parseInt(message.substr(9,1), 16) & 0b0010) {
               output['operation'] = 'GET' 
            } else {
               output['operation'] = 'PUT'
            }
            if(parseInt(message.substr(9,1), 16) & 0b0001) {
                output['type'] = 'DATA'
                var data = []
                data.push(parseInt(message.substr(11, 2), 16))
                data.push(parseInt(message.substr(13, 2), 16))
                data.push(parseInt(message.substr(15, 2), 16))
                data.push(parseInt(message.substr(17, 2), 16))
                data.push(parseInt(message.substr(19, 2), 16))
                data.push(parseInt(message.substr(21, 2), 16))
                data.push(parseInt(message.substr(23, 2), 16))
                data.push(parseInt(message.substr(25, 2), 16))
                output['data'] = data
                output['text'] = JSON.stringify(output)
            } else {
                output['type'] = 'CONTROL'
                output['address'] = message.substr(15, 2) + message.substr(13, 2) + message.substr(11, 2)
                output['RESVD'] = parseInt(message.substr(17, 2), 16)
                output['CTLBT'] = parseInt(message.substr(19, 2), 16)
                output['SPCMD'] = parseInt(message.substr(21, 2), 16)
                output['CPDTL'] = parseInt(message.substr(23, 2), 16)
                output['CPDTH'] = parseInt(message.substr(25, 2), 16)
                output['text'] = JSON.stringify(output)
            }
        } else if (message.length >= 13) {
                output['operation'] = 'RESPONSE' 
                output['response'] = parseInt(message.substr(11, 2), 16)
                output['text'] = JSON.stringify(output)
        } else {
                output['Type'] = 'UNKNOWN MESSAGE'
                output['text'] = JSON.stringify(output)
        }
        return output
    }

    /**
    * @desc encode a CBUS message<br>
    * This will encode either a 11 bit 'standard' or 29 bit 'extended' ID CBUS message from a supplied JSON object into a 'grid connect' ascii format<br>
    * If the correct JSON properties for the parameters for the encoding are not present, an exception will be thrown<br>
    * The JSON properties shared by both encode() & decode() are identical - however note decode() may return more properties than encode() requires<br>
    * @param {Object} message - CBUS message properties as a JSON object
    * @return {Object} returns the original input JSON object with the resultant encoded CBUS message added using the 'encoded' property
    *
    */
    encode(message){
        if(message.hasOwnProperty('ID_TYPE')) {
            switch (message['ID_TYPE']) {
                case 'S':
                    return this.encodeStandardMessage(message);
                    break;
                case 'X':
                    return this.encodeExtendedMessage(message);
                    break;
                default:
                    throw Error('encode: ID_TYPE ' + message.ID_TYPE + ' not supported');
                    break;
            }
        }
        else{
            // assume its a standard message if no ID type supplied, so check if 'mnemonic' present
            if(message.hasOwnProperty('mnemonic')) {
                return this.encodeStandardMessage(message);
            }
            else {
                throw Error('encode: unable to determine message type - no ID_TYPE present');
            }
        }
    }

    /**
    * @desc encode a standard CBUS message<br>
    * This will encode a 11 bit ID CBUS message from a supplied JSON object into a 'grid connect' ascii format<br>
    * The supplied JSON must include the mnemonic for the opcode, and any necessary parameters for that specific opcode<br>
    * If the correct JSON properties for the parameters for the opcode are not present, an exception will be thrown<br>
    * The JSON properties shared by both encode() & decode() are identical - however note decode() may return more properties than encode() requires<br>
    * @param {Object} message - CBUS message properties as a JSON object - content dependant on specific CBUS opcode, but must always contain 'mnemonic'
    * @return {Object} returns the original input JSON object with the resultant encoded CBUS message added using the 'encoded' property
    *
    */
    encodeStandardMessage(message){
        if(message.hasOwnProperty('mnemonic')) {
            switch (message.mnemonic) {
            case 'ACK':     // 00
                message.encoded = this.encodeACK();
                break;
            case 'NAK':     // 01
                message.encoded = this.encodeNAK();
                break;
            case 'HLT':     // 02
                message.encoded = this.encodeHLT();
                break;
            case 'BON':     // 03
                message.encoded = this.encodeBON();
                break;
            case 'TOF':     // 04
                message.encoded = this.encodeTOF();
                break;
            case 'TON':     // 05
                message.encoded = this.encodeTON();
                break;
            case 'ESTOP':   // 06
                message.encoded = this.encodeESTOP();
                break;
            case 'ARST':    // 07
                message.encoded = this.encodeARST();
                break;
            case 'RTOF':    // 08
                message.encoded = this.encodeRTOF();
                break;
            case 'RTON':    // 09
                message.encoded = this.encodeRTON();
                break;
            case 'RESTP':    // 0A
                message.encoded = this.encodeRESTP();
                break;
            case 'RSTAT':    // 0C
                message.encoded = this.encodeRSTAT();
                break;
            case 'QNN':    // 0D
                message.encoded = this.encodeQNN();
                break;
            case 'RQNP':    // 10
                message.encoded = this.encodeRQNP();
                break;
            case 'RQMN':    // 11
                message.encoded = this.encodeRQMN();
                break;
            case 'GSTOP':    // 12
                message.encoded = this.encodeGSTOP();
                break;
            case 'KLOC':    // 21
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                message.encoded = this.encodeKLOC(message.session);
                break;
            case 'QLOC':    // 22
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                message.encoded = this.encodeQLOC(message.session);
                break;
            case 'DKEEP':    // 23
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                message.encoded = this.encodeDKEEP(message.session);
                break;
            case 'DBG1':    // 30
                if(!message.hasOwnProperty('status')) {throw Error("encode: property 'status' missing")};
                message.encoded = this.encodeDBG1(message.status);
                break;
            case 'EXTC':    // 3F
                if(!message.hasOwnProperty('Ext_OPC')) {throw Error("encode: property 'Ext_OPC' missing")};
                message.encoded = this.encodeEXTC(message.Ext_OPC);
                break;
            case 'RLOC':    // 40
                if(!message.hasOwnProperty('address')) {throw Error("encode: property 'address' missing")};
                message.encoded = this.encodeRLOC(message.address);
                break;
            case 'QCON':    // 41
                if(!message.hasOwnProperty('conID')) {throw Error("encode: property 'conID' missing")};
                if(!message.hasOwnProperty('index')) {throw Error("encode: property 'index' missing")};
                message.encoded = this.encodeQCON(message.conID, message.index);
                break;
            case 'SNN':    // 42
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeSNN(message.nodeNumber);
                break;
            case 'ALOC':    // 43
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                if(!message.hasOwnProperty('allocationCode')) {throw Error("encode: property 'allocationCode' missing")};
                message.encoded = this.encodeALOC(message.session, message.allocationCode);
                break;
            case 'STMOD':    // 44
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                if(!message.hasOwnProperty('modeByte')) {throw Error("encode: property 'modeByte' missing")};
                message.encoded = this.encodeSTMOD(message.session, message.modeByte);
                break;
            case 'PCON':    // 45
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                if(!message.hasOwnProperty('consistAddress')) {throw Error("encode: property 'consistAddress' missing")};
                message.encoded = this.encodePCON(message.session, message.consistAddress);
                break;
            case 'KCON':    // 46
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                if(!message.hasOwnProperty('consistAddress')) {throw Error("encode: property 'consistAddress' missing")};
                message.encoded = this.encodeKCON(message.session, message.consistAddress);
                break;
            case 'DSPD':    // 47
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                if(!message.hasOwnProperty('speed')) {throw Error("encode: property 'speed' missing")};
                if(!message.hasOwnProperty('direction')) {throw Error("encode: property 'direction' missing")};
                message.encoded = this.encodeDSPD(message.session, message.speed, message.direction);
                break;
            case 'DFLG':    // 48
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                if(!message.hasOwnProperty('flags')) {throw Error("encode: property 'flags' missing")};
                message.encoded = this.encodeDFLG(message.session, message.flags);
                break;
            case 'DFNON':    // 49
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                if(!message.hasOwnProperty('functionNumber')) {throw Error("encode: property 'functionNumber' missing")};
                message.encoded = this.encodeDFNON(message.session, message.functionNumber);
                break;
            case 'DFNOF':    // 4A
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                if(!message.hasOwnProperty('functionNumber')) {throw Error("encode: property 'functionNumber' missing")};
                message.encoded = this.encodeDFNOF(message.session, message.functionNumber);
                break;
            case 'SSTAT':    // 4C
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                if(!message.hasOwnProperty('status')) {throw Error("encode: property 'status' missing")};
                message.encoded = this.encodeSSTAT(message.session, message.status);
                break;
            case 'NNRSM':    // 4F
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeNNRSM(message.nodeNumber);
                break;
            case 'RQNN':    // 50
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeRQNN(message.nodeNumber);
                break;
            case 'NNREL':    // 51
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeNNREL(message.nodeNumber);
                break;
            case 'NNACK':    // 52
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeNNACK(message.nodeNumber);
                break;
            case 'NNLRN':    // 53
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeNNLRN(message.nodeNumber);
                break;
            case 'NNULN':    // 54
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeNNULN(message.nodeNumber);
                break;
            case 'NNCLR':    // 55
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeNNCLR(message.nodeNumber, message.status);
                break;
            case 'NNEVN':    // 56
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeNNEVN(message.nodeNumber);
                break;
            case 'NERD':    // 57
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeNERD(message.nodeNumber);
                break;
            case 'RQEVN':   // 58
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeRQEVN(message.nodeNumber);
                break;
            case 'WRACK':   // 59
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeWRACK(message.nodeNumber);
                break;
            case 'RQDAT':   // 5A
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeRQDAT(message.nodeNumber);
                break;
            case 'RQDDS':   // 5B
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeRQDDS(message.nodeNumber);
                break;
            case 'BOOTM':   // 5C
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeBOOTM(message.nodeNumber);
                break;
            case 'ENUM':   // 5D
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeENUM(message.nodeNumber);
                break;
            case 'NNRST':   // 5E
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                message.encoded = this.encodeNNRST(message.nodeNumber);
                break;
            case 'EXTC1':   // 5F
                if(!message.hasOwnProperty('Ext_OPC')) {throw Error("encode: property 'Ext_OPC' missing")};
                if(!message.hasOwnProperty('byte1')) {throw Error("encode: property 'byte1' missing")};
                message.encoded = this.encodeEXTC1(message.Ext_OPC, message.byte1);
                break;
            case 'DFUN':   // 60
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                if(!message.hasOwnProperty('Fn1')) {throw Error("encode: property 'Fn1' missing")};
                if(!message.hasOwnProperty('Fn2')) {throw Error("encode: property 'Fn2' missing")};
                message.encoded = this.encodeDFUN(message.session, message.Fn1, message.Fn2);
                break;
            case 'GLOC':   // 61
                if(!message.hasOwnProperty('address')) {throw Error("encode: property 'address' missing")};
                if(!message.hasOwnProperty('flags')) {throw Error("encode: property 'flags' missing")};
                message.encoded = this.encodeGLOC(message.address, message.flags);
                break;
            case 'ERR':   // 63
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                if(!message.hasOwnProperty('errorNumber')) {throw Error("encode: property 'errorNumber' missing")};
                message.encoded = this.encodeERR(message.data1, message.data2, message.errorNumber);
                break;
            case 'SQU':   // 66
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('capacityIndex')) {throw Error("encode: property 'capacityIndex' missing")};
                message.encoded = this.encodeSQU(message.nodeNumber, message.capacityIndex);
                break;
            case 'CMDERR':   // 6F
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('errorNumber')) {throw Error("encode: property 'errorNumber' missing")};
                message.encoded = this.encodeCMDERR(message.nodeNumber, message.errorNumber);
                break;
            case 'EVNLF':   // 70
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('EVSPC')) {throw Error("encode: property 'EVSPC' missing")};
                message.encoded = this.encodeEVNLF(message.nodeNumber, message.EVSPC);
                break;
            case 'NVRD':   // 71
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('nodeVariableIndex')) {throw Error("encode: property 'nodeVariableIndex' missing")};
                message.encoded = this.encodeNVRD(message.nodeNumber, message.nodeVariableIndex);
                break;
            case 'NENRD':   // 72
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventIndex')) {throw Error("encode: property 'eventIndex' missing")};
                message.encoded = this.encodeNENRD(message.nodeNumber, message.eventIndex);
                break;
            case 'RQNPN':   // 73
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('parameterIndex')) {throw Error("encode: property 'parameterIndex' missing")};
                message.encoded = this.encodeRQNPN(message.nodeNumber, message.parameterIndex);
                break;
            case 'NUMEV':   // 74
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventCount')) {throw Error("encode: property 'eventCount' missing")};
                message.encoded = this.encodeNUMEV(message.nodeNumber, message.eventCount);
                break;
            case 'CANID':   // 75
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('CAN_ID')) {throw Error("encode: property 'CAN_ID' missing")};
                message.encoded = this.encodeCANID(message.nodeNumber, message.CAN_ID);
                break;
            case 'MODE':   // 76
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('ModeNumber')) {throw Error("encode: property 'ModeNumber' missing")};
                message.encoded = this.encodeMODE(message.nodeNumber, message.ModeNumber);
                break;
            case 'RQSD':   // 78
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('ServiceIndex')) {throw Error("encode: property 'ServiceIndex' missing")};
                message.encoded = this.encodeRQSD(message.nodeNumber, message.ServiceIndex);
                break;
            case 'EXTC2':   // 7F
                if(!message.hasOwnProperty('Ext_OPC')) {throw Error("encode: property 'Ext_OPC' missing")};
                if(!message.hasOwnProperty('byte1')) {throw Error("encode: property 'byte1' missing")};
                if(!message.hasOwnProperty('byte2')) {throw Error("encode: property 'byte2' missing")};
                message.encoded = this.encodeEXTC2(message.Ext_OPC, message.byte1, message.byte2);
                break;
            case 'RDCC3':   // 80
                if(!message.hasOwnProperty('repetitions')) {throw Error("encode: property 'repetitions' missing")};
                if(!message.hasOwnProperty('byte0')) {throw Error("encode: property 'byte0' missing")};
                if(!message.hasOwnProperty('byte1')) {throw Error("encode: property 'byte1' missing")};
                if(!message.hasOwnProperty('byte2')) {throw Error("encode: property 'byte2' missing")};
                message.encoded = this.encodeRDCC3(message.repetitions, message.byte0, message.byte1, message.byte2);
                break;
            case 'WCVO':   // 82
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                if(!message.hasOwnProperty('CV')) {throw Error("encode: property 'CV' missing")};
                if(!message.hasOwnProperty('value')) {throw Error("encode: property 'value' missing")};
                message.encoded = this.encodeWCVO(message.session, message.CV, message.value);
                break;
            case 'WCVB':   // 83
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                if(!message.hasOwnProperty('CV')) {throw Error("encode: property 'CV' missing")};
                if(!message.hasOwnProperty('value')) {throw Error("encode: property 'value' missing")};
                message.encoded = this.encodeWCVB(message.session, message.CV, message.value);
                break;
            case 'QCVS':   // 84
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                if(!message.hasOwnProperty('CV')) {throw Error("encode: property 'CV' missing")};
                if(!message.hasOwnProperty('mode')) {throw Error("encode: property 'mode' missing")};
                message.encoded = this.encodeQCVS(message.session, message.CV, message.mode);
                break;
            case 'PCVS':   // 85
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                if(!message.hasOwnProperty('CV')) {throw Error("encode: property 'CV' missing")};
                if(!message.hasOwnProperty('value')) {throw Error("encode: property 'value' missing")};
                message.encoded = this.encodePCVS(message.session, message.CV, message.value);
                break;
            case 'RDGN':   // 87
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('ServiceIndex')) {throw Error("encode: property 'ServiceIndex' missing")};
                if(!message.hasOwnProperty('DiagnosticCode')) {throw Error("encode: property 'DiagnosticCode' missing")};
                message.encoded = this.encodeRDGN(message.nodeNumber, message.ServiceIndex, message.DiagnosticCode);
                break;
            case 'NVSETRD':   // 8E
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('nodeVariableIndex')) {throw Error("encode: property 'nodeVariableIndex' missing")};
                if(!message.hasOwnProperty('nodeVariableValue')) {throw Error("encode: property 'nodeVariableValue' missing")};
                message.encoded = this.encodeNVSETRD(message.nodeNumber, message.nodeVariableIndex, message.nodeVariableValue);
                break;
            case 'ACON':   // 90
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                message.encoded = this.encodeACON(message.nodeNumber, message.eventNumber);
                break;
            case 'ACOF':   // 91
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                message.encoded = this.encodeACOF(message.nodeNumber, message.eventNumber);
                break;
            case 'AREQ':   // 92
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                message.encoded = this.encodeAREQ(message.nodeNumber, message.eventNumber);
                break;
            case 'ARON':   // 93
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                message.encoded = this.encodeARON(message.nodeNumber, message.eventNumber);
                break;
            case 'AROF':   // 94
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                message.encoded = this.encodeAROF(message.nodeNumber, message.eventNumber);
                break;
            case 'EVULN':   // 95
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                message.encoded = this.encodeEVULN(message.nodeNumber, message.eventNumber);
                break;
            case 'NVSET':   // 96
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('nodeVariableIndex')) {throw Error("encode: property 'nodeVariableIndex' missing")};
                if(!message.hasOwnProperty('nodeVariableValue')) {throw Error("encode: property 'nodeVariableValue' missing")};
                message.encoded = this.encodeNVSET(message.nodeNumber, message.nodeVariableIndex, message.nodeVariableValue);
                break;
            case 'NVANS':   // 97
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('nodeVariableIndex')) {throw Error("encode: property 'nodeVariableIndex' missing")};
                if(!message.hasOwnProperty('nodeVariableValue')) {throw Error("encode: property 'nodeVariableValue' missing")};
                message.encoded = this.encodeNVANS(message.nodeNumber, message.nodeVariableIndex, message.nodeVariableValue);
                break;
            case 'ASON':   // 98
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                message.encoded = this.encodeASON(message.nodeNumber, message.deviceNumber);
                break;
            case 'ASOF':   // 99
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                message.encoded = this.encodeASOF(message.nodeNumber, message.deviceNumber);
                break;
            case 'ASRQ':   // 9A
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                message.encoded = this.encodeASRQ(message.nodeNumber, message.deviceNumber);
                break;
            case 'PARAN':   // 9B
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('parameterIndex')) {throw Error("encode: property 'parameterIndex' missing")};
                if(!message.hasOwnProperty('parameterValue')) {throw Error("encode: property 'parameterValue' missing")};
                message.encoded = this.encodePARAN(message.nodeNumber, message.parameterIndex, message.parameterValue);
                break;
            case 'REVAL':   // 9C
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventIndex')) {throw Error("encode: property 'eventIndex' missing")};
                if(!message.hasOwnProperty('eventVariableIndex')) {throw Error("encode: property 'eventVariableIndex' missing")};
                message.encoded = this.encodeREVAL(message.nodeNumber, message.eventIndex, message.eventVariableIndex);
                break;
            case 'ARSON':   // 9D
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                message.encoded = this.encodeARSON(message.nodeNumber, message.deviceNumber);
                break;
            case 'ARSOF':   // 9E
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                message.encoded = this.encodeARSOF(message.nodeNumber, message.deviceNumber);
                break;
            case 'EXTC3':   // 9F
                if(!message.hasOwnProperty('Ext_OPC')) {throw Error("encode: property 'Ext_OPC' missing")};
                if(!message.hasOwnProperty('byte1')) {throw Error("encode: property 'byte1' missing")};
                if(!message.hasOwnProperty('byte2')) {throw Error("encode: property 'byte2' missing")};
                if(!message.hasOwnProperty('byte3')) {throw Error("encode: property 'byte3' missing")};
                message.encoded = this.encodeEXTC3(message.Ext_OPC, message.byte1, message.byte2, message.byte3);
                break;
            case 'RDCC4':   // A0
                if(!message.hasOwnProperty('repetitions')) {throw Error("encode: property 'repetitions' missing")};
                if(!message.hasOwnProperty('byte0')) {throw Error("encode: property 'byte0' missing")};
                if(!message.hasOwnProperty('byte1')) {throw Error("encode: property 'byte1' missing")};
                if(!message.hasOwnProperty('byte2')) {throw Error("encode: property 'byte2' missing")};
                if(!message.hasOwnProperty('byte3')) {throw Error("encode: property 'byte3' missing")};
                message.encoded = this.encodeRDCC4(message.repetitions, message.byte0, message.byte1, message.byte2, message.byte3);
                break;
            case 'WCVS':   // A2
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                if(!message.hasOwnProperty('CV')) {throw Error("encode: property 'CV' missing")};
                if(!message.hasOwnProperty('mode')) {throw Error("encode: property 'mode' missing")};
                if(!message.hasOwnProperty('value')) {throw Error("encode: property 'value' missing")};
                message.encoded = this.encodeWCVS(message.session, message.CV, message.mode, message.value);
                break;
            case 'HEARTB':   // AB
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('SequenceCount')) {throw Error("encode: property 'SequenceCount' missing")};
                if(!message.hasOwnProperty('StatusByte1')) {throw Error("encode: property 'StatusByte1' missing")};
                if(!message.hasOwnProperty('StatusByte2')) {throw Error("encode: property 'StatusByte2' missing")};
                message.encoded = this.encodeHEARTB(message.nodeNumber, message.SequenceCount, message.StatusByte1, message.StatusByte2);
                break;
            case 'SD':   // AC
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('ServiceIndex')) {throw Error("encode: property 'ServiceIndex' missing")};
                if(!message.hasOwnProperty('ServiceType')) {throw Error("encode: property 'ServiceType' missing")};
                if(!message.hasOwnProperty('ServiceVersion')) {throw Error("encode: property 'ServiceVersion' missing")};
                message.encoded = this.encodeSD(message.nodeNumber, message.ServiceIndex, message.ServiceType, message.ServiceVersion);
                break;
            case 'GRSP':   // AF
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('requestOpCode')) {throw Error("encode: property 'requestOpCode' missing")};
                if(!message.hasOwnProperty('serviceType')) {throw Error("encode: property 'serviceType' missing")};
                if(!message.hasOwnProperty('result')) {throw Error("encode: property 'result' missing")};
                message.encoded = this.encodeGRSP(message.nodeNumber, message.requestOpCode, message.serviceType, message.result);
                break;
            case 'ACON1':   // B0
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                message.encoded = this.encodeACON1(message.nodeNumber, message.eventNumber, message.data1);
                break;
            case 'ACOF1':   // B1
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                message.encoded = this.encodeACOF1(message.nodeNumber, message.eventNumber, message.data1);
                break;
            case 'REQEV':   // B2
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                if(!message.hasOwnProperty('eventVariableIndex')) {throw Error("encode: property 'eventVariableIndex' missing")};
                message.encoded = this.encodeREQEV(message.nodeNumber, message.eventNumber, message.eventVariableIndex);
                break;
            case 'ARON1':   // B3
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                message.encoded = this.encodeARON1(message.nodeNumber, message.eventNumber, message.data1);
                break;
            case 'AROF1':   // B4
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                message.encoded = this.encodeAROF1(message.nodeNumber, message.eventNumber, message.data1);
                break;
            case 'NEVAL':   // B5
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventIndex')) {throw Error("encode: property 'eventIndex' missing")};
                if(!message.hasOwnProperty('eventVariableIndex')) {throw Error("encode: property 'eventVariableIndex' missing")};
                if(!message.hasOwnProperty('eventVariableValue')) {throw Error("encode: property 'eventVariableValue' missing")};
                message.encoded = this.encodeNEVAL(message.nodeNumber, message.eventIndex, message.eventVariableIndex, message.eventVariableValue);
                break;
            case 'PNN':   // B6
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('manufacturerId')) {throw Error("encode: property 'manufacturerId' missing")};
                if(!message.hasOwnProperty('moduleId')) {throw Error("encode: property 'moduleId' missing")};
                if(!message.hasOwnProperty('flags')) {throw Error("encode: property 'flags' missing")};
                message.encoded = this.encodePNN(message.nodeNumber, message.manufacturerId, message.moduleId, message.flags);
                break;
            case 'ASON1':   // B8
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                message.encoded = this.encodeASON1(message.nodeNumber, message.deviceNumber, message.data1);
                break;
            case 'ASOF1':   // B9
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                message.encoded = this.encodeASOF1(message.nodeNumber, message.deviceNumber, message.data1);
                break;
            case 'ARSON1':   // BD
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                message.encoded = this.encodeARSON1(message.nodeNumber, message.deviceNumber, message.data1);
                break;
            case 'ARSOF1':   // BE
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                message.encoded = this.encodeARSOF1(message.nodeNumber, message.deviceNumber, message.data1);
                break;
            case 'EXTC4':   // BF
                if(!message.hasOwnProperty('Ext_OPC')) {throw Error("encode: property 'Ext_OPC' missing")};
                if(!message.hasOwnProperty('byte1')) {throw Error("encode: property 'byte1' missing")};
                if(!message.hasOwnProperty('byte2')) {throw Error("encode: property 'byte2' missing")};
                if(!message.hasOwnProperty('byte3')) {throw Error("encode: property 'byte3' missing")};
                if(!message.hasOwnProperty('byte4')) {throw Error("encode: property 'byte4' missing")};
                message.encoded = this.encodeEXTC4(message.Ext_OPC, message.byte1, message.byte2, message.byte3, message.byte4);
                break;
            case 'RDCC5':   // C0
                if(!message.hasOwnProperty('repetitions')) {throw Error("encode: property 'repetitions' missing")};
                if(!message.hasOwnProperty('byte0')) {throw Error("encode: property 'byte0' missing")};
                if(!message.hasOwnProperty('byte1')) {throw Error("encode: property 'byte1' missing")};
                if(!message.hasOwnProperty('byte2')) {throw Error("encode: property 'byte2' missing")};
                if(!message.hasOwnProperty('byte3')) {throw Error("encode: property 'byte3' missing")};
                if(!message.hasOwnProperty('byte4')) {throw Error("encode: property 'byte4' missing")};
                message.encoded = this.encodeRDCC5(message.repetitions, message.byte0, message.byte1, message.byte2, message.byte3, message.byte4);
                break;
            case 'WCVOA':   // C1
                if(!message.hasOwnProperty('address')) {throw Error("encode: property 'address' missing")};
                if(!message.hasOwnProperty('CV')) {throw Error("encode: property 'CV' missing")};
                if(!message.hasOwnProperty('mode')) {throw Error("encode: property 'mode' missing")};
                if(!message.hasOwnProperty('value')) {throw Error("encode: property 'value' missing")};
                message.encoded = this.encodeWCVOA(message.address, message.CV, message.mode, message.value);
                break;
            case 'CABDAT':   // C2
                if(!message.hasOwnProperty('address')) {throw Error("encode: property 'address' missing")};
                if(!message.hasOwnProperty('datcode')) {throw Error("encode: property 'datcode' missing")};
                if(!message.hasOwnProperty('aspect1')) {throw Error("encode: property 'aspect1' missing")};
                if(!message.hasOwnProperty('aspect2')) {throw Error("encode: property 'aspect2' missing")};
                if(!message.hasOwnProperty('speed')) {throw Error("encode: property 'speed' missing")};
                message.encoded = this.encodeCABDAT(message.address, message.datcode, message.aspect1, message.aspect2, message.speed);
                break;
            case 'DGN':   // C7
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('ServiceIndex')) {throw Error("encode: property 'ServiceIndex' missing")};
                if(!message.hasOwnProperty('DiagnosticCode')) {throw Error("encode: property 'DiagnosticCode' missing")};
                if(!message.hasOwnProperty('DiagnosticValue')) {throw Error("encode: property 'DiagnosticValue' missing")};
                message.encoded = this.encodeDGN(message.nodeNumber, message.ServiceIndex, message.DiagnosticCode, message.DiagnosticValue);
                break;
            case 'FCLK':   // CF
                if(!message.hasOwnProperty('minutes')) {throw Error("encode: property 'minutes' missing")};
                if(!message.hasOwnProperty('hours')) {throw Error("encode: property 'hours' missing")};
                if(!message.hasOwnProperty('dayOfWeek')) {throw Error("encode: property 'dayOfWeek' missing")};
                if(!message.hasOwnProperty('dayOfMonth')) {throw Error("encode: property 'dayOfMonth' missing")};
                if(!message.hasOwnProperty('month')) {throw Error("encode: property 'month' missing")};
                if(!message.hasOwnProperty('div')) {throw Error("encode: property 'div' missing")};
                if(!message.hasOwnProperty('temperature')) {throw Error("encode: property 'temperature' missing")};
                message.encoded = this.encodeFCLK(message.minutes, message.hours, message.dayOfWeek, message.dayOfMonth, message.month, message.div, message.temperature);
                break;
            case 'ACON2':   // D0
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                message.encoded = this.encodeACON2(message.nodeNumber, message.eventNumber, message.data1, message.data2);
                break;
            case 'ACOF2':   // D1
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                message.encoded = this.encodeACOF2(message.nodeNumber, message.eventNumber, message.data1, message.data2);
                break;
            case 'EVLRN':   // D2
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                if(!message.hasOwnProperty('eventVariableIndex')) {throw Error("encode: property 'eventVariableIndex' missing")};
                if(!message.hasOwnProperty('eventVariableValue')) {throw Error("encode: property 'eventVariableValue' missing")};
                message.encoded = this.encodeEVLRN(message.nodeNumber, message.eventNumber, message.eventVariableIndex, message.eventVariableValue);
                break;
            case 'EVANS':   // D3
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                if(!message.hasOwnProperty('eventVariableIndex')) {throw Error("encode: property 'eventVariableIndex' missing")};
                if(!message.hasOwnProperty('eventVariableValue')) {throw Error("encode: property 'eventVariableValue' missing")};
                message.encoded = this.encodeEVANS(message.nodeNumber, message.eventNumber, message.eventVariableIndex, message.eventVariableValue);
                break;
            case 'ARON2':   // D4
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                message.encoded = this.encodeARON2(message.nodeNumber, message.eventNumber, message.data1, message.data2);
                break;
            case 'AROF2':   // D5
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                message.encoded = this.encodeAROF2(message.nodeNumber, message.eventNumber, message.data1, message.data2);
                break;
            case 'ASON2':   // D8
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                message.encoded = this.encodeASON2(message.nodeNumber, message.deviceNumber, message.data1, message.data2);
                break;
            case 'ASOF2':   // D9
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                message.encoded = this.encodeASOF2(message.nodeNumber, message.deviceNumber, message.data1, message.data2);
                break;
            case 'ARSON2':   // DD
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                message.encoded = this.encodeARSON2(message.nodeNumber, message.deviceNumber, message.data1, message.data2);
                break;
            case 'ARSOF2':   // DE
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                message.encoded = this.encodeARSOF2(message.nodeNumber, message.deviceNumber, message.data1, message.data2);
                break;
            case 'EXTC5':   // DF
                if(!message.hasOwnProperty('Ext_OPC')) {throw Error("encode: property 'Ext_OPC' missing")};
                if(!message.hasOwnProperty('byte1')) {throw Error("encode: property 'byte1' missing")};
                if(!message.hasOwnProperty('byte2')) {throw Error("encode: property 'byte2' missing")};
                if(!message.hasOwnProperty('byte3')) {throw Error("encode: property 'byte3' missing")};
                if(!message.hasOwnProperty('byte4')) {throw Error("encode: property 'byte4' missing")};
                if(!message.hasOwnProperty('byte5')) {throw Error("encode: property 'byte5' missing")};
                message.encoded = this.encodeEXTC5(message.Ext_OPC, message.byte1, message.byte2, message.byte3, message.byte4, message.byte5);
                break;
            case 'RDCC6':       // E0
                if(!message.hasOwnProperty('repetitions')) {throw Error("encode: property 'repetitions' missing")};
                if(!message.hasOwnProperty('byte0')) {throw Error("encode: property 'byte0' missing")};
                if(!message.hasOwnProperty('byte1')) {throw Error("encode: property 'byte1' missing")};
                if(!message.hasOwnProperty('byte2')) {throw Error("encode: property 'byte2' missing")};
                if(!message.hasOwnProperty('byte3')) {throw Error("encode: property 'byte3' missing")};
                if(!message.hasOwnProperty('byte4')) {throw Error("encode: property 'byte4' missing")};
                if(!message.hasOwnProperty('byte5')) {throw Error("encode: property 'byte5' missing")};
                message.encoded = this.encodeRDCC6(message.repetitions, message.byte0, message.byte1, message.byte2, message.byte3, message.byte4, message.byte5);
                break;
            case 'PLOC':    // E1
                if(!message.hasOwnProperty('session')) {throw Error("encode: property 'session' missing")};
                if(!message.hasOwnProperty('address')) {throw Error("encode: property 'address' missing")};
                if(!message.hasOwnProperty('speed')) {throw Error("encode: property 'speed' missing")};
                if(!message.hasOwnProperty('direction')) {throw Error("encode: property 'direction' missing")};
                if(!message.hasOwnProperty('Fn1')) {throw Error("encode: property 'Fn1' missing")};
                if(!message.hasOwnProperty('Fn2')) {throw Error("encode: property 'Fn2' missing")};
                if(!message.hasOwnProperty('Fn3')) {throw Error("encode: property 'Fn3' missing")};
                message.encoded = this.encodePLOC(message.session, message.address, message.speed, message.direction, message.Fn1, message.Fn2, message.Fn3);
                break;
            case 'NAME':    // E2
                if(!message.hasOwnProperty('name')) {throw Error("encode: property 'name' missing")};
                message.encoded = this.encodeNAME(message.name);
                break;
            case 'STAT':    // E3
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('CS')) {throw Error("encode: property 'CS' missing")};
                if(!message.hasOwnProperty('flags')) {throw Error("encode: property 'flags' missing")};
                if(!message.hasOwnProperty('major')) {throw Error("encode: property 'major' missing")};
                if(!message.hasOwnProperty('minor')) {throw Error("encode: property 'minor' missing")};
                if(!message.hasOwnProperty('build')) {throw Error("encode: property 'build' missing")};
                message.encoded = this.encodeSTAT(message.nodeNumber, message.CS, message.flags, message.major, message.minor, message.build);
                break;
            case 'ENACK':    // E6
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('ackOpCode')) {throw Error("encode: property 'ackOpCode' missing")};
                if(!message.hasOwnProperty('eventIdentifier')) {throw Error("encode: property 'eventIdentifier' missing")};
                message.encoded = this.encodeENACK(message.nodeNumber, message.ackOpCode, message.eventIdentifier);
                break;
            case 'ESD':    // E7
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('ServiceIndex')) {throw Error("encode: property 'ServiceIndex' missing")};
                if(!message.hasOwnProperty('ServiceType')) {throw Error("encode: property 'ServiceType' missing")};
                if(!message.hasOwnProperty('Data1')) {throw Error("encode: property 'Data1' missing")};
                if(!message.hasOwnProperty('Data2')) {throw Error("encode: property 'Data2' missing")};
                if(!message.hasOwnProperty('Data3')) {throw Error("encode: property 'Data3' missing")};
                message.encoded = this.encodeESD(message.nodeNumber, message.ServiceIndex, message.ServiceType, message.Data1, message.Data2, message.Data3);
                break;
            case 'DTXC':    // E9
                if(!message.hasOwnProperty('streamIdentifier')) {throw Error("encode: property 'streamIdentifier' missing")};
                if(!message.hasOwnProperty('sequenceNumber')) {throw Error("encode: property 'sequenceNumber' missing")};
                if(message.sequenceNumber == 0){
                  if(!message.hasOwnProperty('messageLength')) {throw Error("encode: property 'messageLength' missing")};
                  if(!message.hasOwnProperty('CRC16')) {throw Error("encode: property 'CRC16' missing")};
                  if(!message.hasOwnProperty('flags')) {throw Error("encode: property 'flags' missing")};
                  message.encoded = this.encodeDTXC_SEQ0(message.streamIdentifier, message.sequenceNumber, message.messageLength, message.CRC16, message.flags)
                } else {
                  if(!message.hasOwnProperty('Data1')) {throw Error("encode: property 'Data1' missing")};
                  if(!message.hasOwnProperty('Data2')) {throw Error("encode: property 'Data2' missing")};
                  if(!message.hasOwnProperty('Data3')) {throw Error("encode: property 'Data3' missing")};
                  if(!message.hasOwnProperty('Data4')) {throw Error("encode: property 'Data4' missing")};
                  if(!message.hasOwnProperty('Data5')) {throw Error("encode: property 'Data5' missing")};
                  message.encoded = this.encodeDTXC(message.streamIdentifier, message.sequenceNumber, message.Data1, message.Data2, message.Data3, message.Data4, message.Data5)
                }
                break;
            case 'PARAMS':       // EF
                if(!message.hasOwnProperty('param1')) {throw Error("encode: property 'param1' missing")};
                if(!message.hasOwnProperty('param2')) {throw Error("encode: property 'param2' missing")};
                if(!message.hasOwnProperty('param3')) {throw Error("encode: property 'param3' missing")};
                if(!message.hasOwnProperty('param4')) {throw Error("encode: property 'param4' missing")};
                if(!message.hasOwnProperty('param5')) {throw Error("encode: property 'param5' missing")};
                if(!message.hasOwnProperty('param6')) {throw Error("encode: property 'param6' missing")};
                if(!message.hasOwnProperty('param7')) {throw Error("encode: property 'param7' missing")};
                message.encoded = this.encodePARAMS(message.param1, message.param2, message.param3, message.param4, message.param5, message.param6, message.param7);
                break;
            case 'ACON3':   // F0
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                if(!message.hasOwnProperty('data3')) {throw Error("encode: property 'data3' missing")};
                message.encoded = this.encodeACON3(message.nodeNumber, message.eventNumber, message.data1, message.data2, message.data3);
                break;
            case 'ACOF3':   // F1
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                if(!message.hasOwnProperty('data3')) {throw Error("encode: property 'data3' missing")};
                message.encoded = this.encodeACOF3(message.nodeNumber, message.eventNumber, message.data1, message.data2, message.data3);
                break;
            case 'ENRSP':   // F2
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventIdentifier')) {throw Error("encode: property 'eventIdentifier' missing")};
                if(!message.hasOwnProperty('eventIndex')) {throw Error("encode: property 'eventIndex' missing")};
                message.encoded = this.encodeENRSP(message.nodeNumber, message.eventIdentifier, message.eventIndex);
                break;
            case 'ARON3':   // F3
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                if(!message.hasOwnProperty('data3')) {throw Error("encode: property 'data3' missing")};
                message.encoded = this.encodeARON3(message.nodeNumber, message.eventNumber, message.data1, message.data2, message.data3);
                break;
            case 'AROF3':   // F4
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                if(!message.hasOwnProperty('data3')) {throw Error("encode: property 'data3' missing")};
                message.encoded = this.encodeAROF3(message.nodeNumber, message.eventNumber, message.data1, message.data2, message.data3);
                break;
            case 'EVLRNI':   // F5
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('eventNumber')) {throw Error("encode: property 'eventNumber' missing")};
                if(!message.hasOwnProperty('eventNumberIndex')) {throw Error("encode: property 'eventNumberIndex' missing")};
                if(!message.hasOwnProperty('eventVariableIndex')) {throw Error("encode: property 'eventVariableIndex' missing")};
                if(!message.hasOwnProperty('eventVariableValue')) {throw Error("encode: property 'eventVariableValue' missing")};
                message.encoded = this.encodeEVLRNI(message.nodeNumber, message.eventNumber, message.eventNumberIndex, message.eventVariableIndex, message.eventVariableValue);
                break;
            case 'ACDAT':   // F6
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                if(!message.hasOwnProperty('data3')) {throw Error("encode: property 'data3' missing")};
                if(!message.hasOwnProperty('data4')) {throw Error("encode: property 'data4' missing")};
                if(!message.hasOwnProperty('data5')) {throw Error("encode: property 'data5' missing")};
                message.encoded = this.encodeACDAT(message.nodeNumber, message.data1, message.data2, message.data3, message.data4, message.data5);
                break;
            case 'ARDAT':   // F7
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                if(!message.hasOwnProperty('data3')) {throw Error("encode: property 'data3' missing")};
                if(!message.hasOwnProperty('data4')) {throw Error("encode: property 'data4' missing")};
                if(!message.hasOwnProperty('data5')) {throw Error("encode: property 'data5' missing")};
                message.encoded = this.encodeARDAT(message.nodeNumber, message.data1, message.data2, message.data3, message.data4, message.data5);
                break;
            case 'ASON3':   // F8
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                if(!message.hasOwnProperty('data3')) {throw Error("encode: property 'data3' missing")};
                message.encoded = this.encodeASON3(message.nodeNumber, message.deviceNumber, message.data1, message.data2, message.data3);
                break;
            case 'ASOF3':   // F9
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                if(!message.hasOwnProperty('data3')) {throw Error("encode: property 'data3' missing")};
                message.encoded = this.encodeASOF3(message.nodeNumber, message.deviceNumber, message.data1, message.data2, message.data3);
                break;
            case 'DDES':   // FA
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                if(!message.hasOwnProperty('data3')) {throw Error("encode: property 'data3' missing")};
                if(!message.hasOwnProperty('data4')) {throw Error("encode: property 'data4' missing")};
                if(!message.hasOwnProperty('data5')) {throw Error("encode: property 'data5' missing")};
                message.encoded = this.encodeDDES(message.deviceNumber, message.data1, message.data2, message.data3, message.data4, message.data5);
                break;
            case 'DDRS':   // FB
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                if(!message.hasOwnProperty('data3')) {throw Error("encode: property 'data3' missing")};
                if(!message.hasOwnProperty('data4')) {throw Error("encode: property 'data4' missing")};
                if(!message.hasOwnProperty('data5')) {throw Error("encode: property 'data5' missing")};
                message.encoded = this.encodeDDRS(message.deviceNumber, message.data1, message.data2, message.data3, message.data4, message.data5);
                break;
            case 'DDWS':   // FC
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                if(!message.hasOwnProperty('data3')) {throw Error("encode: property 'data3' missing")};
                if(!message.hasOwnProperty('data4')) {throw Error("encode: property 'data4' missing")};
                if(!message.hasOwnProperty('data5')) {throw Error("encode: property 'data5' missing")};
                message.encoded = this.encodeDDWS(message.deviceNumber, message.data1, message.data2, message.data3, message.data4, message.data5);
                break;
            case 'ARSON3':   // FD
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                if(!message.hasOwnProperty('data3')) {throw Error("encode: property 'data3' missing")};
                message.encoded = this.encodeARSON3(message.nodeNumber, message.deviceNumber, message.data1, message.data2, message.data3);
                break;
            case 'ARSOF3':   // FE
                if(!message.hasOwnProperty('nodeNumber')) {throw Error("encode: property 'nodeNumber' missing")};
                if(!message.hasOwnProperty('deviceNumber')) {throw Error("encode: property 'deviceNumber' missing")};
                if(!message.hasOwnProperty('data1')) {throw Error("encode: property 'data1' missing")};
                if(!message.hasOwnProperty('data2')) {throw Error("encode: property 'data2' missing")};
                if(!message.hasOwnProperty('data3')) {throw Error("encode: property 'data3' missing")};
                message.encoded = this.encodeARSOF3(message.nodeNumber, message.deviceNumber, message.data1, message.data2, message.data3);
                break;
            case 'EXTC6':   // FF
                if(!message.hasOwnProperty('Ext_OPC')) {throw Error("encode: property 'Ext_OPC' missing")};
                if(!message.hasOwnProperty('byte1')) {throw Error("encode: property 'byte1' missing")};
                if(!message.hasOwnProperty('byte2')) {throw Error("encode: property 'byte2' missing")};
                if(!message.hasOwnProperty('byte3')) {throw Error("encode: property 'byte3' missing")};
                if(!message.hasOwnProperty('byte4')) {throw Error("encode: property 'byte4' missing")};
                if(!message.hasOwnProperty('byte5')) {throw Error("encode: property 'byte5' missing")};
                if(!message.hasOwnProperty('byte6')) {throw Error("encode: property 'byte6' missing")};
                message.encoded = this.encodeEXTC6(message.Ext_OPC, message.byte1, message.byte2, message.byte3, message.byte4, message.byte5, message.byte6);
                break;
            default:
                throw Error('encode standard: \'' + message.mnemonic + '\' not supported');
                break;
            }
            return message;
        }
        else {
                throw Error("encode standard: property 'mnemonic' missing");
        }
    }
    

    encodeExtendedMessage(message){
        if(message.hasOwnProperty('operation')) {
            switch (message.operation) {
                case 'PUT':
                    if(message.hasOwnProperty('type')){
                        if (message.type == 'CONTROL') {
                            if(!message.hasOwnProperty('address')) {throw Error("encode extended: property 'address' missing")};
                            if(!message.hasOwnProperty('CTLBT')) {throw Error("encode extended: property 'CTLBT' missing")};
                            if(!message.hasOwnProperty('SPCMD')) {throw Error("encode extended: property 'SPCMD' missing")};
                            if(!message.hasOwnProperty('CPDTL')) {throw Error("encode extended: property 'CPDTL' missing")};
                            if(!message.hasOwnProperty('CPDTH')) {throw Error("encode extended: property 'CPDTH' missing")};
                            message.encoded = this.encode_EXT_PUT_CONTROL(message.address, message.CTLBT, message.SPCMD, message.CPDTL, message.CPDTH);
                        }
                        else if (message.type == 'DATA') {
                            if(!message.hasOwnProperty('data')) {throw Error("encode extended: property 'data' missing")};
                            message.encoded = this.encode_EXT_PUT_DATA(message.data);
                        }
                        else {
                            throw Error('encode extended: type \'' + message.type + '\' not supported');
                        }
                            
                    } else {
                        throw Error("encode extended: property \'type\' missing");
                    }
                    break;
                case 'GET':
                    break;
                case 'RESPONSE':
                    if(!message.hasOwnProperty('response')) {throw Error("encode extended: property 'response' missing")};
                    message.encoded = this.encode_EXT_RESPONSE(message.response);
                    break;
                default:
                     throw Error('encode extended: \'' + message.operation + '\' not supported');
                   break;
            }
            return message;
        } else {
            throw Error("encode extended: property \'operation\' missing");
        }
    }
    
    
    /**
    * @desc 29 bit Extended CAN Identifier 'Put Control' firmware download message<br>
    * @param {string} address 6 digit hexadecimal number 000000 to FFFFFF
    * @param {int} CTLBT 0 to 255
    * @param {int} SPCMD 0 to 255
    * @param {int} CPDTL 0 to 255
    * @param {int} CPDTH 0 to 255
    * @return {string} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Example :X00080004N000000000D040000;<br>
    * 29 bit fixed header (:X00080004N.......)
    */
    encode_EXT_PUT_CONTROL(address, CTLBT, SPCMD, CPDTL, CPDTH) {
        // Format: <header> ADDRL ADDRH ADDRU RESVD CTLBT SPCMD CPDTL CPDTH
		return ":X00080004N" + address.substr(4, 2) + address.substr(2, 2) + address.substr(0, 2) + '00' + decToHex(CTLBT, 2) + decToHex(SPCMD, 2) + decToHex(CPDTL, 2) + decToHex(CPDTH, 2) + ";";
    }
    

    /**
    * @desc 29 bit Extended CAN Identifier 'Put Data' firmware download message<br>
    * @param {array} data 8 byte data array 
    * @return {string} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Example :X00080005N20EF04F0FFFFFFFF;<br>
    * 29 bit fixed header (:X00080004N.......)
    */
    encode_EXT_PUT_DATA(data) {
		return ":X00080005N" + 
            decToHex(data[0], 2) + 
            decToHex(data[1], 2) + 
            decToHex(data[2], 2) + 
            decToHex(data[3], 2) + 
            decToHex(data[4], 2) + 
            decToHex(data[5], 2) + 
            decToHex(data[6], 2) + 
            decToHex(data[7], 2) + ";";
    }
    

    /**
    * @desc 29 bit Extended CAN Identifier firmware download 'response' message<br>
    * @param {int} response response number to firmware download control message 
    * @return {string} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Example :X80180004N02;<br>
    * 29 bit fixed header (:X80080004N.......)
    */
    encode_EXT_RESPONSE(response) {
		return ":X80080004N" + decToHex(response, 2) + ";";
    }
    

    // 00 ACK
    // ACK Format: [<MjPri><MinPri=2><CANID>]<00>
    decodeACK(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ACK',
                'opCode': message.substr(7, 2),
                'text': 'ACK (00)',
        }
    }
    /**
    * @desc opCode 00<br>
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt00&gt
    */
    encodeACK() {
        return this.header({MinPri: 2}) + '00' + ';'
    }


    // 01 NAK
    // NAK Format: [<MjPri><MinPri=2><CANID>]<01>
    //
    decodeNAK(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NAK',
                'opCode': message.substr(7, 2),
                'text': 'NAK (01)',
        }
    }
    /**
    * @desc opCode 01<br>
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt01&gt
    */
    encodeNAK() {
        return this.header({MinPri: 2}) + '01' + ';'
    }


    // 02 HLT
    // HLT Format: [<MjPri><MinPri=0><CANID>]<02>
    //
    decodeHLT(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'HLT',
                'opCode': message.substr(7, 2),
                'text': 'HLT (02)',
        }
    }
    /**
    * @desc opCode 02<br>
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=0&gt&ltCANID&gt]&lt02&gt
    */
    encodeHLT() {
        return this.header({MinPri: 0}) + '02' + ';'
    }


    // 03 BON
    // BON Format: [<MjPri><MinPri=1><CANID>]<03>
    //
    decodeBON(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'BON',
                'opCode': message.substr(7, 2),
                'text': 'BON (03)',
        }
    }
    /**
    * @desc opCode 03<br>
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=1&gt&ltCANID&gt]&lt03&gt
    */
    encodeBON() {
        return this.header({MinPri: 1}) + '03' + ';'
    }


    // 04 TOF
    // TOF Format: [<MjPri><MinPri=1><CANID>]<04>
    //
    decodeTOF(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'TOF',
                'opCode': message.substr(7, 2),
                'text': 'TOF (04)',
        }
    }
    /**
    * @desc opCode 04<br>
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=1&gt&ltCANID&gt]&lt04&gt
    */
    encodeTOF() {
        return this.header({MinPri: 1}) + '04' + ';'
    }


    // 05 TON
    // TON Format: [<MjPri><MinPri=1><CANID>]<05>
    //
    decodeTON(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'TON',
                'opCode': message.substr(7, 2),
                'text': 'TON (05)',
        }
    }
     /**
    * @desc opCode 05<br>
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=1&gt&ltCANID&gt]&lt05&gt
    */
   encodeTON() {
        return this.header({MinPri: 1}) + '05' + ';'
    }


    // 06 ESTOP
    // ESTOP Format: [<MjPri><MinPri=1><CANID>]<06>
    //
    decodeESTOP(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ESTOP',
                'opCode': message.substr(7, 2),
                'text': 'ESTOP (06)',
        }
    }
    /**
    * @desc opCode 06<br>
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=1&gt&ltCANID&gt]&lt06&gt
    */
    encodeESTOP() {
        return this.header({MinPri: 1}) + '06' + ';'
    }


    // 07 ARST
    // ARST Format: [<MjPri><MinPri=0><CANID>]<07>
    //
    decodeARST(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ARST',
                'opCode': message.substr(7, 2),
                'text': 'ARST (07)',
        }
    }
    /**
    * @desc opCode 07<br>
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=0&gt&ltCANID&gt]&lt07&gt
    */
    encodeARST() {
        return this.header({MinPri: 0}) + '07' + ';'
    }


    // 08 RTOF
    // RTOF Format: [<MjPri><MinPri=1><CANID>]<08>
    //
    decodeRTOF(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RTOF',
                'opCode': message.substr(7, 2),
                'text': 'RTOF (08)',
        }
    }
    /**
    * @desc opCode 08<br>
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=0&gt&ltCANID&gt]&lt08&gt
    */
    encodeRTOF() {
        return this.header({MinPri: 1}) + '08' + ';'
    }


    // 09 RTON
    // RTON Format: [<MjPri><MinPri=1><CANID>]<09>
    //
    decodeRTON(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RTON',
                'opCode': message.substr(7, 2),
                'text': 'RTON (09)',
        }
    }
    /**
    * @desc opCode 09<br>
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=0&gt&ltCANID&gt]&lt09&gt
    */
    encodeRTON() {
        return this.header({MinPri: 1}) + '09' + ';'
    }


    // 0A RESTP
    // RESTP Format: [<MjPri><MinPri=0><CANID>]<0A>
    //
    decodeRESTP(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RESTP',
                'opCode': message.substr(7, 2),
                'text': 'RESTP (0A)',
        }
    }
    /**
    * @desc opCode 0A<br>
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=0&gt&ltCANID&gt]&lt0A&gt
    */
    encodeRESTP() {
        return this.header({MinPri: 0}) + '0A' + ';'
    }


    // 0C RSTAT
    // RSTAT Format: [<MjPri><MinPri=2><CANID>]<0C>
    //
    decodeRSTAT(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RSTAT',
                'opCode': message.substr(7, 2),
                'text': 'RSTAT (0C)',
        }
    }
    /**
    * @desc opCode 0C<br>
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt0C&gt
    */
    encodeRSTAT() {
        return this.header({MinPri: 2}) + '0C' + ';'
    }


    // 0D QNN
    // QNN Format: [<MjPri><MinPri=3><CANID>]<0D>
    //
    decodeQNN(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'QNN',
                'opCode': message.substr(7, 2),
                'text': 'QNN (0D)',
        }
    }
    /**
    * @desc opCode 0D<br>
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt0D&gt
    */
    encodeQNN() {//Request Node Parameters
        return this.header({MinPri: 3}) + '0D' + ';'
    }


    // 10 RQNP
    // RQNP Format: [<MjPri><MinPri=3><CANID>]<10>
    //
    decodeRQNP(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RQNP',
                'opCode': message.substr(7, 2),
                'text': 'RQNP (10)',
        }
    }
    /**
    * @desc opCode 10<br>
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt10&gt
    */
    encodeRQNP() {
        return this.header({MinPri: 3}) + '10' + ';'
    }


    // 11 RQMN
	// RQMN Format: [<MjPri><MinPri=2><CANID>]<11>
    //
    decodeRQMN(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RQMN',
                'opCode': message.substr(7, 2),
                'text': 'RQMN (11)',
        }
    }
    /**
    * @desc opCode 11<br>
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt11&gt
    */
    encodeRQMN() {//Request Node Parameters
        return this.header({MinPri: 2}) + '11' + ';'
    }


    // 12 GSTOP
    // GSTOP Format: [<MjPri><MinPri=1><CANID>]<12>
    //
    decodeGSTOP(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'GSTOP',
                'opCode': message.substr(7, 2),
                'text': 'GSTOP (12)',
        }
    }
    /**
    * @desc opCode 12<br>
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=0&gt&ltCANID&gt]&lt12&gt
    */
    encodeGSTOP() {
        return this.header({MinPri: 1}) + '12' + ';'
    }


    // 21 KLOC
    // KLOC Format: [<MjPri><MinPri=2><CANID>]<21><Session>
    //
    decodeKLOC(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'KLOC',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'text': 'KLOC (21) Session ' + parseInt(message.substr(9, 2), 16),
        }
    }
    /**
    * @desc opCode 21<br>
    * @param {int} session number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt21&gt&ltsession&gt
    */
    encodeKLOC(session) {
        return this.header({MinPri: 2}) + '21' + decToHex(session, 2) + ';';
    }
    

    // 22 QLOC
	// QLOC Format: [<MjPri><MinPri=2><CANID>]<22><Session>
    //
    decodeQLOC(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'QLOC',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'text': 'QLOC (22) session ' + parseInt(message.substr(9, 2), 16),
        }
    }
    /**
    * @desc opCode 22<br>
    * @param {int} session number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt22&gt&ltsession&gt
    */
    encodeQLOC(session) {
        return this.header({MinPri: 2}) + '22' + decToHex(session, 2) + ';';
    }


    // 23 DKEEP
    // DKEEP Format: [<MjPri><MinPri=2><CANID>]<23><Session>
    //
    decodeDKEEP(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'DKEEP',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'text': 'DKEEP (23) session ' + parseInt(message.substr(9, 2), 16),
        }
    }
    /**
    * @desc opCode 23<br>
    * @param {int} session number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt23&gt&ltsession&gt
    */
    encodeDKEEP(session) {
        return this.header({MinPri: 2}) + '23' + decToHex(session, 2) + ';';
    }
    

    // 30 DBG1
    // DBG1 Format: [<MjPri><MinPri=2><CANID>]<30><Status>
    //
    decodeDBG1(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'DBG1',
                'opCode': message.substr(7, 2),
                'status': parseInt(message.substr(9, 2), 16),
                'text': 'DBG1 (30) status ' + parseInt(message.substr(9, 2), 16),
        }
    }
    /**
    * @desc opCode 30<br>
    * @param {int} status number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt30&gt&ltstatus&gt
    */
    encodeDBG1(status) {
        return this.header({MinPri: 2}) + '30' + decToHex(status, 2) + ';';
    }
    

    // 3F EXTC
    // EXTC Format: [<MjPri><MinPri=3><CANID>]<3F><Ext_OPC>
    //
    decodeEXTC(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'EXTC',
                'opCode': message.substr(7, 2),
                'Ext_OPC': parseInt(message.substr(9, 2), 16),
                'text': 'EXTC (3F) Ext_OPC ' + parseInt(message.substr(9, 2), 16),
        }
    }
    /**
    * @desc opCode 3F<br>
    * @param {int} Ext_OPC number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt3F&gt&ltExt_OPC&gt
    */
    encodeEXTC(Ext_OPC) {
        return this.header({MinPri: 3}) + '3F' + decToHex(Ext_OPC, 2) + ';';
    }
    

    // 40 RLOC
	// RLOC Format: [<MjPri><MinPri=2><CANID>]<40><Dat1><Dat2 >
    // <Dat1> and <Dat2> are [AddrH] and [AddrL] of the decoder, respectively.
    //
    decodeRLOC(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RLOC',
                'opCode': message.substr(7, 2),
                'address': parseInt(message.substr(9, 4), 16),
                'text': 'RLOC (40) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 40<br>
    * @param {int} address number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt40&gt&ltaddress hi&gt&ltaddress lo&gt
    */
    encodeRLOC(address) {
        return this.header({MinPri: 2}) + '40' + decToHex(address, 4) + ';'
    }


    // 41 QCON
	// RLOC Format: <MjPri><MinPri=2><CANID>]<41><conID><Index>
    //
    decodeQCON(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'QCON',
                'opCode': message.substr(7, 2),
                'conID': parseInt(message.substr(9, 2), 16),
                'index': parseInt(message.substr(11, 2), 16),
                'text': 'QCON (41) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 41<br>
    * @param {int} conID number 0 to 255
    * @param {int} index number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt41&gt&ltConID&gt&ltindex&gt
    */
    encodeQCON(conID, index) {
        return this.header({MinPri: 2}) + '41' + decToHex(conID, 2) + decToHex(index, 2) + ';'
    }


    // 42 SNN
	// SNN Format: [<MjPri><MinPri=3><CANID>]<42><NNHigh><NNLow>
    //
    decodeSNN(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'SNN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'SNN (42) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 42<br>
    * @param {int} nodeNumber number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt42&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt
    */
    encodeSNN(nodeNumber) {
            return this.header({MinPri: 3}) + '42' + decToHex(nodeNumber, 4) + ';'
    }


    // 43 ALOC
	// ALOC Format: [<MjPri><MinPri=2><CANID>]<43><Session ID><Allocation code >
    //
    decodeALOC(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ALOC',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'allocationCode': parseInt(message.substr(11, 2), 16),
                'text': 'ALOC (43) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 43<br>
    * @param {int} session number 0 to 255
    * @param {int} allocatonCode number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt43&gt&ltsession&gt&ltallocatonCode&gt
    */
    encodeALOC(session, allocationCode) {
            return this.header({MinPri: 2}) + '43' + decToHex(session, 2) + decToHex(allocationCode, 2) + ';'
    }


    // 44 STMOD
	// STMOD Format: [<MjPri><MinPri=2><CANID>]<44><Session><MMMMMMMM>
    //
    decodeSTMOD(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'STMOD',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'modeByte': parseInt(message.substr(11, 2), 16),
                'text': 'STMOD (44) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 44<br>
    * @param {int} session number 0 to 255
    * @param {int} modeByte number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt44&gt&ltsession&gt&ltmodeByte&gt
    */
    encodeSTMOD(session, modeByte) {
            return this.header({MinPri: 2}) + '44' + decToHex(session, 2) + decToHex(modeByte, 2) + ';'
    }


    // 45 PCON
	// PCON Format: [<MjPri><MinPri=2><CANID>]<45><Session><Consist#>
    //
    decodePCON(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'PCON',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'consistAddress': parseInt(message.substr(11, 2), 16),
                'text': 'PCON (45) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 45<br>
    * @param {int} session number 0 to 255
    * @param {int} consistAddress number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt45&gt&ltsession&gt&ltconsistAddress&gt
    */
    encodePCON(session, consistAddress) {
            return this.header({MinPri: 2}) + '45' + decToHex(session, 2) + decToHex(consistAddress, 2) + ';'
    }


    // 46 KCON
	// KCON Format: Format: [<MjPri><MinPri=2><CANID>]<46><Session><Consist#>
    //
    decodeKCON(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'KCON',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'consistAddress': parseInt(message.substr(11, 2), 16),
                'text': 'KCON (46) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 46<br>
    * @param {int} session number 0 to 255
    * @param {int} consistAddress number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt46&gt&ltsession&gt&ltconsistAddress&gt
    */
    encodeKCON(session, consistAddress) {
            return this.header({MinPri: 2}) + '46' + decToHex(session, 2) + decToHex(consistAddress, 2) + ';'
    }


    // 47 DSPD
    // DSPD Format: [<MjPri><MinPri=2><CANID>]<47><Session><Speed/Dir>
    //
    decodeDSPD(message) {
        var speedDir = parseInt(message.substr(11, 2), 16)
        var direction = (speedDir > 127) ? 'Forward' : 'Reverse'
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'DSPD',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'speed': speedDir % 128,
                'direction': direction,
                'text': 'DSPD (47) Session ' + parseInt(message.substr(9, 2), 16) + 
                    ' Speed ' + speedDir % 128 + 
                    ' Direction ' + direction,
        }
    }
    /**
    * @desc opCode 47<br>
    * @param {int} session number 0 to 255
    * @param {int} speed number 0 to 127
    * @param {string} direction 'Reverse' or 'Forward' (defaults to 'Forward' if string not matching 'Reverse')
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt46&gt&ltsession&gt&ltspeed/dir&gt
    */
    encodeDSPD(session, speed, direction) {
        var speedDir = (speed & 0x7F) + parseInt((direction == 'Reverse') ? 0 : 128)
        return this.header({MinPri: 2}) + '47' + decToHex(session, 2) + decToHex(speedDir, 2) + ';';
    }
    

    // 48 DFLG
	// DFLG Format: Format: <MjPri><MinPri=2><CANID>]<48><Session><DDDDDDDD>
    //
    decodeDFLG(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'DFLG',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'flags': parseInt(message.substr(11, 2), 16),
                'text': 'DFLG (48) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 48<br>
    * @param {int} session number 0 to 255
    * @param {int} flags bits 0 to 7
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt48&gt&ltsession&gt&ltflags&gt
    */
    encodeDFLG(session, flags) {
            return this.header({MinPri: 2}) + '48' + decToHex(session, 2) + decToHex(flags, 2) + ';'
    }


    // 49 DFNON
	// DFNON Format: Format: <MjPri><MinPri=2><CANID>]<49><Session><Fnum>
    //
    decodeDFNON(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'DFNON',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'functionNumber': parseInt(message.substr(11, 2), 16),
                'text': 'DFNON (49) session ' + parseInt(message.substr(9, 2), 16) +
                    ' function ' + parseInt(message.substr(11, 2), 16),
        }
    }
    /**
    * @desc opCode 49<br>
    * @param {int} session number 0 to 255
    * @param {int} functionNumber 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt49&gt&ltsession&gt&ltfunctionNumber&gt
    */
    encodeDFNON(session, functionNumber) {
            return this.header({MinPri: 2}) + '49' + decToHex(session, 2) + decToHex(functionNumber, 2) + ';'
    }


    // 4A DFNOF
	// DFNOF Format: Format: <MjPri><MinPri=2><CANID>]<4A><Session><Fnum>
    //
    decodeDFNOF(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'DFNOF',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'functionNumber': parseInt(message.substr(11, 2), 16),
                'text': 'DFNOF (4A) session ' + parseInt(message.substr(9, 2), 16) +
                    ' function ' + parseInt(message.substr(11, 2), 16),
        }
    }
    /**
    * @desc opCode 4A<br>
    * @param {int} session number 0 to 255
    * @param {int} functionNumber 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt4A&gt&ltsession&gt&ltfunctionNumber&gt
    */
    encodeDFNOF(session, Function) {
            return this.header({MinPri: 2}) + '4A' + decToHex(session, 2) + decToHex(Function, 2) + ';'
    }


    // 4C SSTAT
	// SSTAT Format: Format: [<MjPri><MinPri=3><CANID>]<4C><Session><Status>
    //
    decodeSSTAT(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'SSTAT',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'status': parseInt(message.substr(11, 2), 16),
                'text': 'SSTAT (4C) session ' + parseInt(message.substr(9, 2), 16) +
                    ' status ' + parseInt(message.substr(11, 2), 16),
        }
    }
    /**
    * @desc opCode 4C<br>
    * @param {int} session number 0 to 255
    * @param {int} status 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt4C&gt&ltsession&gt&ltstatus&gt
    */
    encodeSSTAT(session, status) {
            return this.header({MinPri: 3}) + '4C' + decToHex(session, 2) + decToHex(status, 2) + ';'
    }


    // 4F NNRSM
	// NNRSM Format: Format: [<MjPri><MinPri=3><CANID>]<4F><NN hi><NN lo>
    //
    decodeNNRSM(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NNRSM',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'NNRSM (4F) NodeNumber ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 4F<br>
    * @param {int} session number 0 to 255
    * @param {int} status 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt4F&gt&ltnodeNumber&gt
    */
    encodeNNRSM(nodeNumber) {
            return this.header({MinPri: 3}) + '4F' + decToHex(nodeNumber, 4) + ';'
    }


    // 50 RQNN
	// RQNN Format: [<MjPri><MinPri=3><CANID>]<50><NN hi><NN lo>
    //
    decodeRQNN(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RQNN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'RQNN (50) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 50<br>
    * @param {int} nodeNumber number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt50&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt
    */
    encodeRQNN(nodeNumber) {
        return this.header({MinPri: 3}) + '50' + decToHex(nodeNumber, 4) + ';'
    }
    

    // 51 NNREL
	// NNREL Format: [<MjPri><MinPri=3><CANID>]<51><NN hi><NN lo>
    //
    decodeNNREL(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NNREL',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'NNREL (51) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 51<br>
    * @param {int} nodeNumber number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt51&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt
    */
    encodeNNREL(nodeNumber) {
        return this.header({MinPri: 3}) + '51' + decToHex(nodeNumber, 4) + ';'
    }
    

    // 52 NNACK
	// NNACK Format: [<MjPri><MinPri=3><CANID>]<52><NN hi><NN lo>
    //
    decodeNNACK(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NNACK',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'NNACK (52) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 52<br>
    * @param {int} nodeNumber number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt52&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt
    */
    encodeNNACK(nodeNumber) {
		if (nodeNumber >= 0 && nodeNumber <= 0xFFFF) {
			return this.header({MinPri: 3}) + '52' + decToHex(nodeNumber, 4) + ';'
		}
    }


    // 53 NNLRN
	// NNLRN Format: [<MjPri><MinPri=3><CANID>]<53><NN hi><NN lo>
    //
    decodeNNLRN(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NNLRN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'NNLRN (53) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 53<br>
    * @param {int} nodeNumber number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt53&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt
    */
    encodeNNLRN(nodeNumber) {
		if (nodeNumber >= 0 && nodeNumber <= 0xFFFF) {
			return this.header({MinPri: 3}) + '53' + decToHex(nodeNumber, 4) + ';'
		}
    }


    // 54 NNULN
	// NNULN Format: [<MjPri><MinPri=3><CANID>]<54><NN hi><NN lo>>
    //
    decodeNNULN(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NNULN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'NNULN (54) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 54<br>
    * @param {int} nodeNumber number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt54&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt
    */
    encodeNNULN(nodeNumber) {
        return this.header({MinPri: 3}) + '54' + decToHex(nodeNumber, 4) + ';'
    }


    // 55 NNCLR
	// NNCLR Format: [<MjPri><MinPri=3><CANID>]<55><NN hi><NN lo>>
    //
    decodeNNCLR(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NNCLR',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'NNCLR (55) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 55<br>
    * @param {int} nodeNumber number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt55&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt
    */
    encodeNNCLR(nodeNumber) {
        return this.header({MinPri: 3}) + '55' + decToHex(nodeNumber, 4) + ';'
    }


    // 56 NNEVN
	// NNEVN Format: [<MjPri><MinPri=3><CANID>]<56><NN hi><NN lo>>
    //
    decodeNNEVN(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NNEVN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'NNEVN (56) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 56<br>
    * @param {int} nodeNumber number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt56&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt
    */
    encodeNNEVN(nodeNumber) {
        return this.header({MinPri: 3}) + '56' + decToHex(nodeNumber, 4) + ';'
    }


    // 57 NERD
	// NERD Format: [<MjPri><MinPri=3><CANID>]<57><NN hi><NN lo>
    //
    decodeNERD(message) {
		// NERD Format: [<MjPri><MinPri=3><CANID>]<57><NN hi><NN lo>
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NERD',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'NERD (57) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
     /**
    * @desc opCode 57<br>
    * @param {int} nodeNumber number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt57&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt
    */
   encodeNERD(nodeNumber) {
        return this.header({MinPri: 3}) + '57' + decToHex(nodeNumber, 4) + ';'
    }


    // 58 RQEVN
    // RQEVN Format: [<MjPri><MinPri=3><CANID>]<58><NN hi><NN lo>
    //
    decodeRQEVN(message) {
		// RQEVN Format: [<MjPri><MinPri=3><CANID>]<58><NN hi><NN lo>
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RQEVN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': 'RQEVN (58) Node ' + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 58<br>
    * @param {int} nodeNumber number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt58&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt
    */
    encodeRQEVN(nodeNumber) {
        return this.header({MinPri: 3}) + '58' + decToHex(nodeNumber, 4) + ';'
    }


    // 59 WRACK
	// WRACK Format: [<MjPri><MinPri=3><CANID>]<59><NN hi><NN lo>
    //
    decodeWRACK(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'WRACK',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': "WRACK (59) Node " + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 59<br>
    * @param {int} nodeNumber number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt59&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt
    */
    encodeWRACK(nodeNumber) {
        return this.header({MinPri: 3}) + '59' + decToHex(nodeNumber, 4) + ';'
    }


    // 5A RQDAT
	// RQDAT Format: [<MjPri><MinPri=3><CANID>]<5A><NN hi><NN lo>
    //
    decodeRQDAT(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RQDAT',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': "RQDAT (5A) Node " + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 5A<br>
    * @param {int} nodeNumber number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt5A&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt
    */
    encodeRQDAT(nodeNumber) {
        return this.header({MinPri: 3}) + '5A' + decToHex(nodeNumber, 4) + ';'
    }


    // 5B RQDDS
	// RQDDS Format: [<MjPri><MinPri=3><CANID>]<5B><NN hi><NN lo>
    //
    decodeRQDDS(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RQDDS',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': "RQDDS (5B) Node " + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 5B<br>
    * @param {int} nodeNumber number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt5B&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt
    */
    encodeRQDDS(nodeNumber) {
        return this.header({MinPri: 3}) + '5B' + decToHex(nodeNumber, 4) + ';'
    }


    // 5C BOOTM
	// BOOTM Format: [<MjPri><MinPri=3><CANID>]<5C><NN hi><NN lo>
    //
    decodeBOOTM(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'BOOTM',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': "BOOTM (5C) Node " + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 5C<br>
    * @param {int} nodeNumber number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt5C&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt
    */
    encodeBOOTM(nodeNumber) {
        return this.header({MinPri: 3}) + '5C' + decToHex(nodeNumber, 4) + ';'
    }


    // 5D ENUM
	// ENUM Format: [<MjPri><MinPri=3><CANID>]<5D><NN hi><NN lo>
    //
    decodeENUM(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ENUM',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': "ENUM (5D) Node " + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 5D<br>
    * @param {int} nodeNumber number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt5D&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt
    */
    encodeENUM(nodeNumber) {
        return this.header({MinPri: 3}) + '5D' + decToHex(nodeNumber, 4) + ';'
    }


    // 5E NNRST
	// NNRST Format: [<MjPri><MinPri=3><CANID>]<5E><NN hi><NN lo>
    //
    decodeNNRST(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NNRST',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'text': "NNRST (5E) Node " + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 5E<br>
    * @param {int} nodeNumber number 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt5E&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt
    */
    encodeNNRST(nodeNumber) {
        return this.header({MinPri: 3}) + '5E' + decToHex(nodeNumber, 4) + ';'
    }


    // 5F EXTC1
	// EXTC1 Format: [<MjPri><MinPri=3><CANID>]<5F><Ext_OPC><byte1>
    //
    decodeEXTC1(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'EXTC1',
                'opCode': message.substr(7, 2),
                'Ext_OPC': parseInt(message.substr(9, 2), 16),
                'byte1': parseInt(message.substr(11, 2), 16),
                'text': "EXTC1 (5F) Node " + parseInt(message.substr(9, 4), 16),
        }
    }
    /**
    * @desc opCode 5F<br>
    * @param {int} Ext_OPC number 0 to 255
    * @param {int} byte1 number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt5F&gt&ltExt_OPC&gt&ltbyte1&gt
    */
    encodeEXTC1(Ext_OPC, byte1) {
        return this.header({MinPri: 3}) + '5F' + decToHex(Ext_OPC, 2) + decToHex(byte1, 2) + ';'
    }


    // 60 DFUN
    // DFUN Format: [<MjPri><MinPri=2><CANID>]<60><Session><Fn1><Fn2>
    //
    decodeDFUN(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'DFUN',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'Fn1': parseInt(message.substr(11, 2), 16),
                'Fn2': parseInt(message.substr(13, 2), 16),
                'text': "DFUN (60) Session " + parseInt(message.substr(9, 2), 16) +
					" Fn1 " + parseInt(message.substr(11, 2), 16) +
					" Fn2 " + parseInt(message.substr(13, 2), 16),
        }
    }
    /**
    * @desc opCode 60<br>
    * @param {int} session number 0 to 255
    * @param {int} Fn1 number  0 to 255
    * @param {int} Fn2 number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt60&gt&ltsession&gt&ltFn1&gt&ltFn2&gt
    */
    encodeDFUN(session, Fn1, Fn2) {
        return this.header({MinPri: 2}) + '60' + decToHex(session, 2) + decToHex(Fn1, 2) + decToHex(Fn2, 2) + ';';
    }


    // 61 GLOC
    // GLOC Format: [<MjPri><MinPri=2><CANID>]<61><Dat1><Dat2><Flags>
    // <Dat1> and <Dat2> are [AddrH] and [AddrL] of the decoder, respectively.
    //
    decodeGLOC(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'GLOC',
                'opCode': message.substr(7, 2),
                'address': parseInt(message.substr(9, 4), 16),
                'flags': parseInt(message.substr(13, 2), 16),
                'text': "GLOC (61) address " + parseInt(message.substr(9, 4), 16) +
					" flags " + parseInt(message.substr(13, 2), 16),
        }
    }
    /**
    * @desc opCode 61<br>
    * @param {int} address number 0 to 65535
    * @param {int} flags number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt61&gt&ltaddress&gt&ltFlags&gt
    */
    encodeGLOC(address, flags) {
        return this.header({MinPri: 2}) + '61' + decToHex(address, 4) + decToHex(flags, 2) + ';';
    }


    // 63 ERR
    // ERR Format: [<MjPri><MinPri=2><CANID>]<63><Dat 1><Dat 2><Dat 3>
    // data 3 is currently assigned to error number
    //
    decodeERR(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ERR',
                'opCode': message.substr(7, 2),
                'data1': parseInt(message.substr(9, 2), 16),
                'data2': parseInt(message.substr(11, 2), 16),
                'errorNumber': parseInt(message.substr(13, 2), 16),
                'text': "ERR (63) data1 " + parseInt(message.substr(9, 2), 16) +
					" data2 " + parseInt(message.substr(11, 2), 16) +
					" errorNumber " + parseInt(message.substr(13, 2), 16),
        }
    }
    /**
    * @desc opCode 63<br>
    * @param {int} data1 number 0 to 255
    * @param {int} data2 number 0 to 255
    * @param {int} errorNumber number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt63&gt&ltdata1&gt&ltdata2&gt&lterrorNumber&gt
    */
    encodeERR(data1, data2, errorNumber) {
        return this.header({MinPri: 2}) + '63' + decToHex(data1, 2) + decToHex(data2, 2) + decToHex(errorNumber, 2) + ';';
    }

    
    // 66 SQU
	// SQU Format: Format: [<MjPri><MinPri=0><CANID>]<66><NN hi><NN lo><capacityIndex>
    //
    decodeSQU(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'SQU',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
				'capacityIndex': parseInt(message.substr(13, 2), 16),
                'text': 'SQU (66) NodeNumber ' + parseInt(message.substr(9, 4), 16) + 
					" capacityIndex " + parseInt(message.substr(13, 2), 16)
        }
    }
    /**
    * @desc opCode 66<br>
    * @param {int} node Number 0 to 65535
    * @param {int} capacityIndex 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt66&gt&ltnodeNumber&gt&ltcapacityIndex&gt
    */
    encodeSQU(nodeNumber, capacityIndex) {
            return this.header({MinPri: 0}) + '66' + decToHex(nodeNumber, 4) + decToHex(capacityIndex, 2) + ';'
    }


    // 6F CMDERR
    // CMDERR Format: [<MjPri><MinPri=3><CANID>]<6F><NN hi><NN lo><Error number>
    //
    decodeCMDERR(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'CMDERR',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'errorNumber': parseInt(message.substr(13, 2), 16),
                'text': "CMDERR (6F) Node " + parseInt(message.substr(9, 4), 16) + 
					" errorNumber " + parseInt(message.substr(13, 2), 16)
        }
    }
    /**
    * @desc opCode 6F<br>
    * @param {int} nodeNumber number 0 to 65535
    * @param {int} errorNumber number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt6F&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lterrorNumber&gt
    */
    encodeCMDERR(nodeNumber, errorNumber) {
        return this.header({MinPri: 3}) + '6F' + decToHex(nodeNumber, 4) + decToHex(errorNumber, 2) + ';';
    }


    // 70 EVNLF
    // EVNLF Format: [<MjPri><MinPri=3><CANID>]<70><NN hi><NN lo><EVSPC>
    //
    decodeEVNLF(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'EVNLF',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'EVSPC': parseInt(message.substr(13, 2), 16),
                'text': "EVNLF (70) Node " + parseInt(message.substr(9, 4), 16) + 
					" EVSPC " + parseInt(message.substr(13, 2), 16)
        }
    }
    /**
    * @desc opCode 70<br>
    * @param {int} nodeNumber number 0 to 65535
    * @param {int} EVSPC number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt70&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltEVNLF&gt
    */
    encodeEVNLF(nodeNumber, EVSPC) {
        return this.header({MinPri: 3}) + '70' + decToHex(nodeNumber, 4) + decToHex(EVSPC, 2) + ';'
    }


    // 71 NVRD
    // NVRD Format: [<MjPri><MinPri=3><CANID>]<71><NN hi><NN lo><NV#>
    //
    decodeNVRD(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NVRD',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'nodeVariableIndex': parseInt(message.substr(13, 2), 16),
                'text': "NVRD (71) Node " + parseInt(message.substr(9, 4), 16) + 
					" Node Variable Index " + parseInt(message.substr(13, 2), 16)
        }
    }
    /**
    * @desc opCode 71<br>
    * @param {int} nodeNumber number 0 to 65535
    * @param {int} nodeVariableIndex number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt71&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltnodeVariableIndex&gt
    */
    encodeNVRD(nodeNumber, nodeVariableIndex) {
        return this.header({MinPri: 3}) + '71' + decToHex(nodeNumber, 4) + decToHex(nodeVariableIndex, 2) + ';'
    }


    // 72 NENRD
	// NENRD Format: [<MjPri><MinPri=3><CANID>]<72><NN hi><NN lo><EN#>
    //
    decodeNENRD(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NENRD',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventIndex': parseInt(message.substr(13, 2), 16),
                'text': "NENRD (72) Node " + parseInt(message.substr(9, 4), 16) + 
					" Event Index " + parseInt(message.substr(13, 2), 16)
        }
    }
    /**
    * @desc opCode 72<br>
    * @param {int} nodeNumber number 0 to 65535
    * @param {int} eventIndex number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt72&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventIndex&gt
    */
    encodeNENRD(nodeNumber, eventIndex) {
        return this.header({MinPri: 3}) + '72' + decToHex(nodeNumber, 4) + decToHex(eventIndex, 2) + ';'
    }


    // 73 RQNPN
    // RQNPN Format: [<MjPri><MinPri=3><CANID>]<73><NN hi><NN lo><Para#>
    //
    decodeRQNPN(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RQNPN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'parameterIndex': parseInt(message.substr(13, 2), 16),
                'text': "RQNPN (73) Node " + parseInt(message.substr(9, 4), 16) + 
					" Node parameter Index " + parseInt(message.substr(13, 2), 16)
        }
    }
    /**
    * @desc opCode 73<br>
    * @param {int} nodeNumber number 0 to 65535
    * @param {int} parameterIndex number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt73&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltparameterIndex&gt
    */
    encodeRQNPN(nodeNumber, parameterIndex) {
        return this.header({MinPri: 3}) + '73' + decToHex(nodeNumber, 4) + decToHex(parameterIndex, 2) + ';'
    }


    // 74 NUMEV
    // NUMEV Format: [<MjPri><MinPri=3><CANID>]<74><NN hi><NN lo><No.of events>
    //
    decodeNUMEV(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NUMEV',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'eventCount': parseInt(message.substr(13, 2), 16),
                'text': "NUMEV (74) Node " + parseInt(message.substr(9, 4), 16) + 
					" Event Count " + parseInt(message.substr(13, 2), 16)
        }
    }
    /**
    * @desc opCode 74<br>
    * @param {int} nodeNumber number 0 to 65535
    * @param {int} eventCount number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt74&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventCount&gt
    */
    encodeNUMEV(nodeNumber, eventCount) {
        return this.header({MinPri: 3}) + '74' + decToHex(nodeNumber, 4) + decToHex(eventCount, 2) + ';'
    }
    

    // 75 CANID
    // CANID Format: [<MjPri><MinPri=3><CANID>]<75><NN hi><NN lo><CAN_ID >
    //
    decodeCANID(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'CANID',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'CAN_ID': parseInt(message.substr(13, 2), 16),
                'text': "CANID (75) Node " + parseInt(message.substr(9, 4), 16) + 
					" CAN_ID " + parseInt(message.substr(13, 2), 16)
        }
    }
    /**
    * @desc opCode 75<br>
    * @param {int} nodeNumber number 0 to 65535
    * @param {int} CAN_ID number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt75&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltCAN_ID&gt
    */
    encodeCANID(nodeNumber, CAN_ID) {
        return this.header({MinPri: 3}) + '75' + decToHex(nodeNumber, 4) + decToHex(CAN_ID, 2) + ';'
    }
    

    // 76 MODE
    // MODE Format: [<MjPri><MinPri=3><CANID>]<76><NN hi><NN lo><ModeNumber>
    //
    decodeMODE(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'MODE',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'ModeNumber': parseInt(message.substr(13, 2), 16),
                'text': "MODE (76) Node Number " + parseInt(message.substr(9, 4), 16) + 
					" Mode Number " + parseInt(message.substr(13, 2), 16)
        }
    }
    /**
    * @desc opCode 76<br>
    * @param {int} nodeNumber number 0 to 65535
    * @param {int} ModeNumber number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt76&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltModeNumber&gt
    */
    encodeMODE(nodeNumber, ModeNumber) {
        return this.header({MinPri: 3}) + '76' + decToHex(nodeNumber, 4) + decToHex(ModeNumber, 2) + ';'
    }
    

    // 78 RQSD
    // RQSD Format: [<MjPri><MinPri=3><CANID>]<78><NN hi><NN lo><ServiceIndex>
    //
    decodeRQSD(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RQSD',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'ServiceIndex': parseInt(message.substr(13, 2), 16),
                'text': "RQSD (78) Node Number " + parseInt(message.substr(9, 4), 16) + 
					" ServiceIndex " + parseInt(message.substr(13, 2), 16)
        }
    }
    /**
    * @desc opCode 78<br>
    * @param {int} nodeNumber number 0 to 65535
    * @param {int} ServiceIndex number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt77&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltServiceIndex&gt
    */
    encodeRQSD(nodeNumber, ServiceIndex) {
        return this.header({MinPri: 3}) + '78' + decToHex(nodeNumber, 4) + decToHex(ServiceIndex, 2) + ';'
    }
    

    // 7F EXTC2
    // EXTC2 Format: [<MjPri><MinPri=3><CANID>]<7F><Ext_OPC><byte1><byte2>
    //
    decodeEXTC2(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'EXTC2',
                'opCode': message.substr(7, 2),
                'Ext_OPC': parseInt(message.substr(9, 2), 16),
                'byte1': parseInt(message.substr(11, 2), 16),
                'byte2': parseInt(message.substr(13, 2), 16),
                'text': "EXTC2 (7F) Ext_OPC " + parseInt(message.substr(9, 2), 16) + 
					" byte1 " + parseInt(message.substr(11, 2), 16) +
					" byte2 " + parseInt(message.substr(13, 2), 16)
        }
    }
    /**
    * @desc opCode 7F<br>
    * @param {int} Ext_OPC number 0 to 255
    * @param {int} byte1 number 0 to 255
    * @param {int} byte2 number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt7F&gt&ltExt_OPC&gt&ltbyte1&gt&ltbyte2&gt
    */
    encodeEXTC2(Ext_OPC, byte1, byte2) {
        return this.header({MinPri: 3}) + '7F' + decToHex(Ext_OPC, 2) + decToHex(byte1, 2) + decToHex(byte2, 2) + ';'
    }
    

    // 80 RDCC3
    // RDCC3 Format: <MjPri><MinPri=2><CANID>]<80><REP><Byte0>..<Byte2>
    //
    decodeRDCC3(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RDCC3',
                'opCode': message.substr(7, 2),
                'repetitions': parseInt(message.substr(9, 2), 16),
                'byte0': parseInt(message.substr(11, 2), 16),
                'byte1': parseInt(message.substr(13, 2), 16),
                'byte2': parseInt(message.substr(15, 2), 16),
                'text': "RDCC3 (80) repetitions " + parseInt(message.substr(9, 2), 16) + 
					" byte0 " + parseInt(message.substr(11, 2), 16) +
					" byte1 " + parseInt(message.substr(13, 2), 16) +
					" byte2 " + parseInt(message.substr(15, 2), 16)
        }
    }
    /**
    * @desc opCode 80<br>
    * @param {int} repetitions number 0 to 255
    * @param {int} byte0 number 0 to 255
    * @param {int} byte1 number 0 to 255
    * @param {int} byte2 number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt80&gt&repetitions&gt&ltbyte0&gt&ltbyte1&gt&ltbyte2&gt
    */
    encodeRDCC3(repetitions, byte0, byte1, byte2) {
        return this.header({MinPri: 2}) + '80' + decToHex(repetitions, 2) + decToHex(byte0, 2) + decToHex(byte1, 2) + decToHex(byte2, 2) + ';'
    }
    

    // 82 WCVO
    // WCVO Format: <MjPri><MinPri=2><CANID>]<82><Session><High CV#><Low CV#><Val>
    //
    decodeWCVO(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'WCVO',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'CV': parseInt(message.substr(11, 4), 16),
                'value': parseInt(message.substr(15, 2), 16),
                'text': "WCVO (82) session " + parseInt(message.substr(9, 2), 16) + 
					" CV " + parseInt(message.substr(11, 4), 16) +
					" value " + parseInt(message.substr(15, 2), 16)
        }
    }
    /**
    * @desc opCode 82<br>
    * @param {int} session number 0 to 255
    * @param {int} CV number 0 to 65535
    * @param {int} value number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt82&gt&ltsession&gt&ltCV hi&gt&ltCV lo&gt&ltvalue&gt
    */
    encodeWCVO(session, CV, value) {
        return this.header({MinPri: 2}) + '82' + decToHex(session, 2) + decToHex(CV, 4) + decToHex(value, 2) + ';'
    }
    

    // 83 WCVB
    // WCVB Format: <MjPri><MinPri=2><CANID>]<83><Session><High CV#><Low CV#><Val>
    //
    decodeWCVB(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'WCVB',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'CV': parseInt(message.substr(11, 4), 16),
                'value': parseInt(message.substr(15, 2), 16),
                'text': "WCVB (83) session " + parseInt(message.substr(9, 2), 16) + 
					" CV " + parseInt(message.substr(11, 2), 16) +
					" value " + parseInt(message.substr(15, 2), 16)
        }
    }
    /**
    * @desc opCode 83<br>
    * @param {int} session number 0 to 255
    * @param {int} CV number 0 to 65535
    * @param {int} value number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt83&gt&ltsession&gt&ltCV hi&gt&ltCV lo&gt&ltvalue&gt
    */
    encodeWCVB(Session, CV, value) {
        return this.header({MinPri: 2}) + '83' + decToHex(Session, 2) + decToHex(CV, 4) + decToHex(value, 2) + ';'
    }
    

    // 84 QCVS
    // QCVS Format: [<MjPri><MinPri=2><CANID>]<84><Session><High CV#><Low CV#><mode>
    //
    decodeQCVS(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'QCVS',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'CV': parseInt(message.substr(11, 4), 16),
                'mode': parseInt(message.substr(15, 2), 16),
                'text': "QCVS (84) session " + parseInt(message.substr(9, 2), 16) + 
					" CV " + parseInt(message.substr(11, 2), 16) +
					" mode " + parseInt(message.substr(15, 2), 16)
        }
    }
    /**
    * @desc opCode 83<br>
    * @param {int} session number 0 to 255
    * @param {int} CV number 0 to 65535
    * @param {int} mode number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt83&gt&ltsession&gt&ltCV hi&gt&ltCV lo&gt&ltMode&gt
    */
    encodeQCVS(Session, CV, mode) {
        return this.header({MinPri: 2}) + '84' + decToHex(Session, 2) + decToHex(CV, 4) + decToHex(mode, 2) + ';'
    }
    

    // 85 PCVS
    // PCVS Format: [<MjPri><MinPri=2><CANID>]<85><Session><High CV#><Low CV#><Val>
    //
    decodePCVS(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'PCVS',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'CV': parseInt(message.substr(11, 4), 16),
                'value': parseInt(message.substr(15, 2), 16),
                'text': "PCVS (85) session " + parseInt(message.substr(9, 2), 16) + 
					" CV " + parseInt(message.substr(11, 2), 16) +
					" value " + parseInt(message.substr(15, 2), 16)
        }
    }
    /**
    * @desc opCode 85<br>
    * @param {int} session number 0 to 255
    * @param {int} CV number 0 to 65535
    * @param {int} value number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt85&gt&ltsession&gt&ltCV hi&gt&ltCV lo&gt&ltvalue&gt
    */
    encodePCVS(Session, CV, value) {
        return this.header({MinPri: 2}) + '85' + decToHex(Session, 2) + decToHex(CV, 4) + decToHex(value, 2) + ';'
    }
    

    // 87 RDGN
    // RDGN Format: [<MjPri><MinPri=3><CANID>]<87><NN hi><NN lo><ServiceIndex><DiagnosticCode>
    //
    decodeRDGN(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RDGN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'ServiceIndex': parseInt(message.substr(13, 2), 16),
                'DiagnosticCode': parseInt(message.substr(15, 2), 16),
                'text': "RDGN (87) Node Number " + parseInt(message.substr(9, 4), 16) + 
					" ServiceIndex " + parseInt(message.substr(13, 2), 16) +
					" DiagnosticCode " + parseInt(message.substr(15, 2), 16)
        }
    }
    /**
    * @desc opCode 87<br>
    * @param {int} nodeNumber number 0 to 65535
    * @param {int} ServiceIndex number 0 to 255
    * @param {int} DiagnosticCode number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt87&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltServiceIndex&gt&ltDiagnosticCode&gt
    */
    encodeRDGN(nodeNumber, ServiceIndex, DiagnosticCode) {
        return this.header({MinPri: 3}) + '87' + decToHex(nodeNumber, 4) + decToHex(ServiceIndex, 2) + decToHex(DiagnosticCode, 2) + ';'
    }
    

    // 8E NVSETRD
    // NVSETRD Format: [<MjPri><MinPri=3><CANID>]<8E><NN hi><NN lo><nodeVariableIndex><nodeVariableValue>
    //
    decodeNVSETRD(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NVSETRD',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'nodeVariableIndex': parseInt(message.substr(13, 2), 16),
                'nodeVariableValue': parseInt(message.substr(15, 2), 16),
                'text': "NVSETRD (8E) Node Number " + parseInt(message.substr(9, 4), 16) + 
					" nodeVariableIndex " + parseInt(message.substr(13, 2), 16) +
					" nodeVariableValue " + parseInt(message.substr(15, 2), 16)
        }
    }
    /**
    * @desc opCode 8E<br>
    * @param {int} nodeNumber number 0 to 65535
    * @param {int} nodeVariableIndex number 0 to 255
    * @param {int} nodeVariableValue number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt8E&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltnodeVariableIndex&gt&ltnodeVariableValue&gt
    */
    encodeNVSETRD(nodeNumber, nodeVariableIndex, nodeVariableValue) {
        return this.header({MinPri: 3}) + '8E' + decToHex(nodeNumber, 4) + decToHex(nodeVariableIndex, 2) + decToHex(nodeVariableValue, 2) + ';'
    }
    

    // 90 ACON
	// ACON Format: [<MjPri><MinPri=3><CANID>]<90><NN hi><NN lo><EN hi><EN lo>
    //
    decodeACON(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ACON',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'eventData': {hex:''},
                'text': "ACON (90) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16)
        }
    }
    /**
    * @desc opCode 90<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt90&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt
    */
    encodeACON(nodeNumber, eventNumber) {
        return this.header({MinPri: 3}) + '90' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) + ';';
    }


    // 91 ACOF
	// ACOF Format: [<MjPri><MinPri=3><CANID>]<91><NN hi><NN lo><EN hi><EN lo>
    //
    decodeACOF(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ACOF',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'eventData': {hex:''},
                'text': "ACOF (91) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16)
        }
    }
    /**
    * @desc opCode 91<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt91&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt
    */
    encodeACOF(nodeNumber, eventNumber) {
        return this.header({MinPri: 3}) + '91' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) + ';';
    }


    // 92 AREQ
	// AREQ Format: [<MjPri><MinPri=3><CANID>]<92><NN hi><NN lo><EN hi><EN lo>
    //
    decodeAREQ(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'AREQ',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'eventData': {hex:''},
                'text': "AREQ (92) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16)
        }
    }
    /**
    * @desc opCode 92<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt92&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt
    */
    encodeAREQ(nodeNumber, eventNumber) {
        return this.header({MinPri: 3}) + '92' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) + ';';
    }


    // 93 ARON
	// ARON Format: [<MjPri><MinPri=3><CANID>]<93><NN hi><NN lo><EN hi><EN lo>
    //
    decodeARON(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ARON',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'eventData': {hex:''},
                'text': "ARON (93) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16)
        }
    }
    /**
    * @desc opCode 93<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt93&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt
    */
    encodeARON(nodeNumber, eventNumber) {
        return this.header({MinPri: 3}) + '93' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) + ';';
    }


    // 94 AROF
	// AROF Format: [<MjPri><MinPri=3><CANID>]<94><NN hi><NN lo><EN hi><EN lo>
    //
    decodeAROF(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'AROF',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'eventData': {hex:''},
                'text': "AROF (94) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16)
        }
    }
    /**
    * @desc opCode 94<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt94&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt
    */
    encodeAROF(nodeNumber, eventNumber) {
        return this.header({MinPri: 3}) + '94' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) + ';';
    }


    // 95 EVULN
	// EVULN Format: [<MjPri><MinPri=3><CANID>]<95><NN hi><NN lo><EN hi><EN lo>
    //
    decodeEVULN(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'EVULN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16), 
                'eventIdentifier': message.substr(9, 8),
                'text': "EVULN (95) nodeNumber " + parseInt(message.substr(9, 4), 16) +
                    " eventNumber " + parseInt(message.substr(13, 4), 16)
        }
    }
    /**
    * @desc opCode 95<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt95&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt
    */
    encodeEVULN(nodeNumber, eventNumber) {
        return this.header({MinPri: 3}) + '95' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) + ';'
    }


    // 96 NVSET
	// NVSET Format: [<MjPri><MinPri=3><CANID>]<96><NN hi><NN lo><NV# ><NV val>
    //
    decodeNVSET(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NVSET',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'nodeVariableIndex': parseInt(message.substr(13, 2), 16), 
                'nodeVariableValue': parseInt(message.substr(15, 2), 16), 
                'text':  "NVSET (96) Node " + parseInt(message.substr(9, 4), 16) + 
					" Node Variable Index " + parseInt(message.substr(13, 2), 16) +
					" Node Variable Value " + parseInt(message.substr(15, 2), 16)
        }
    }
    /**
    * @desc opCode 96<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} nodeVariableIndex 0 to 255
    * @param {int} nodeVariableValue 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt96&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltnodeVariableIndex&gt&ltnodeVariableValue&gt
    */
    encodeNVSET(nodeNumber, nodeVariableIndex, nodeVariableValue) {
        return this.header({MinPri: 3}) + '96' + decToHex(nodeNumber, 4) + decToHex(nodeVariableIndex, 2) + decToHex(nodeVariableValue, 2) + ';'
    }


    // 97 NVANS
    //
    decodeNVANS(message) {
        // NVANS Format: [[<MjPri><MinPri=3><CANID>]<97><NN hi><NN lo><NV# ><NV val>
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NVANS',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'nodeVariableIndex': parseInt(message.substr(13, 2), 16),
                'nodeVariableValue': parseInt(message.substr(15, 2), 16),
                'text':  "NVANS (97) Node " + parseInt(message.substr(9, 4), 16) + 
					" Node Variable Index " + parseInt(message.substr(13, 2), 16) +
					" Node Variable Value " + parseInt(message.substr(15, 2), 16)
        }
    }
    /**
    * @desc opCode 97<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} nodeVariableIndex 0 to 255
    * @param {int} nodeVariableValue 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt97&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltnodeVariableIndex&gt&ltnodeVariableValue&gt
    */
    encodeNVANS(nodeNumber, nodeVariableIndex, nodeVariableValue) {
        return this.header({MinPri: 3}) + '97' + decToHex(nodeNumber, 4) + decToHex(nodeVariableIndex, 2) + decToHex(nodeVariableValue, 2) + ';'
    }
    

    // 98 ASON
	// ASON Format: [<MjPri><MinPri=3><CANID>]<98><NN hi><NN lo><DN hi><DN lo>
    //
    decodeASON(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ASON',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'eventData': {hex:''},
                'text': "ASON (98) Node " + parseInt(message.substr(9, 4), 16) + 
					" Device Number " + parseInt(message.substr(13, 4), 16)
        }
    }
    /**
    * @desc opCode 98<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt98&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt
    */
    encodeASON(nodeNumber, deviceNumber) {
        return this.header({MinPri: 3}) + '98' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) + ';';
    }


    // 99 ASOF
	// ASOF Format: [<MjPri><MinPri=3><CANID>]<99><NN hi><NN lo><DN hi><DN lo>
    //
    decodeASOF(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ASOF',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'eventData': {hex:''},
                'text': "ASOF (99) Node " + parseInt(message.substr(9, 4), 16) + 
					" Device Number " + parseInt(message.substr(13, 4), 16)
        }
    }
    /**
    * @desc opCode 99<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt99&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt
    */
    encodeASOF(nodeNumber, deviceNumber) {
        return this.header({MinPri: 3}) + '99' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) + ';';
    }


    // 9A ASRQ
	// ASRQ Format: [<MjPri><MinPri=3><CANID>]<9A><NN hi><NN lo><DN hi><DN lo>
    //
    decodeASRQ(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ASRQ',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventData': {hex:''},
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'text': "ASRQ (9A) Node " + parseInt(message.substr(9, 4), 16) + 
					" Device Number " + parseInt(message.substr(13, 4), 16)
        }
    }
    /**
    * @desc opCode 99<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt99&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt
    */
    encodeASRQ(nodeNumber, deviceNumber) {
        return this.header({MinPri: 3}) + '9A' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) + ';';
    }


    // 9B PARAN
    // PARAN Format: [<MjPri><MinPri=3><CANID>]<9B><NN hi><NN lo><Para#><Para val>
    //
    decodePARAN(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'PARAN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'parameterIndex': parseInt(message.substr(13, 2), 16),
                'parameterValue': parseInt(message.substr(15, 2), 16),
                'text': "PARAN (9B) Node " + parseInt(message.substr(9, 4), 16) + 
					" Parameter Index " + parseInt(message.substr(13, 2), 16) + 
					" Parameter Value " + parseInt(message.substr(15, 2), 16)
        }
    }
    /**
    * @desc opCode 9B<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} parameterIndex 0 to 255
    * @param {int} parameterValue 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt9B&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltparameterIndex&gt&ltparameterValue&gt
    */
    encodePARAN(nodeNumber, parameterIndex, parameterValue) {
        return this.header({MinPri: 3}) + '9B' + decToHex(nodeNumber, 4) + decToHex(parameterIndex, 2) + decToHex(parameterValue, 2) + ';'
    }


    // 9C REVAL
    // REVAL Format: [<MjPri><MinPri=3><CANID>]<9C><NN hi><NN lo><EN#><EV#>
    //
    decodeREVAL(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'REVAL',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventIndex': parseInt(message.substr(13, 2), 16), 
                'eventVariableIndex': parseInt(message.substr(15, 2), 16), 
                'text': "REVAL (9C) Node " + parseInt(message.substr(9, 4), 16) + 
					" Event Index " + parseInt(message.substr(13, 2), 16) + 
					" Event VariableIndex " + parseInt(message.substr(15, 2), 16)
        }
    }
    /**
    * @desc opCode 9C<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventIndex 0 to 255
    * @param {int} eventVariableIndex 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt9C&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventIndex&gt&lteventVariableIndex&gt
    */
    encodeREVAL(nodeNumber, eventIndex, eventVariableIndex) {
        return this.header({MinPri: 3}) + '9C' + decToHex(nodeNumber, 4) + decToHex(eventIndex, 2) + decToHex(eventVariableIndex, 2) + ';'
    }


    // 9D ARSON
	// ARSON Format: [<MjPri><MinPri=3><CANID>]<9D><NN hi><NN lo><DN hi><DN lo>
    //
    decodeARSON(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ARSON',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventData': {hex:''},
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'text': "ARSON (9D) Node " + parseInt(message.substr(9, 4), 16) + 
					" Device Number " + parseInt(message.substr(13, 4), 16)
        }
    }
    /**
    * @desc opCode 9D<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt9D&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt
    */
    encodeARSON(nodeNumber, deviceNumber) {
        return this.header({MinPri: 3}) + '9D' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) + ';';
    }


    // 9E ARSOF
	// ARSOF Format: [<MjPri><MinPri=3><CANID>]<9F><NN hi><NN lo><DN hi><DN lo>
    //
    decodeARSOF(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ARSOF',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventData': {hex:''},
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'text': "ARSOF (9E) Node " + parseInt(message.substr(9, 4), 16) + 
					" Device Number " + parseInt(message.substr(13, 4), 16)
        }
    }
    /**
    * @desc opCode 9E<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt9E&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt
    */
    encodeARSOF(nodeNumber, deviceNumber) {
        return this.header({MinPri: 3}) + '9E' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) + ';';
    }


    // 9F EXTC3
	// EXTC3 Format: [<MjPri><MinPri=3><CANID>]<9F><Ext_OPC><byte1><byte2><byte3>
    //
    decodeEXTC3(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'EXTC3',
                'opCode': message.substr(7, 2),
                'Ext_OPC': parseInt(message.substr(9, 2), 16), 
                'byte1': parseInt(message.substr(11, 2), 16),
                'byte2': parseInt(message.substr(13, 2), 16),
                'byte3': parseInt(message.substr(15, 2), 16),
                'text': "EXTC3 (9F) Ext_OPC " + parseInt(message.substr(9, 2), 16) + 
					" byte1 " + parseInt(message.substr(11, 4), 16) +
					" byte2 " + parseInt(message.substr(13, 4), 16) +
					" byte3 " + parseInt(message.substr(15, 4), 16)
        }
    }
    /**
    * @desc opCode 9F<br>
    * @param {int} Ext_OPC 0 to 255
    * @param {int} byte1 0 to 255
    * @param {int} byte2 0 to 255
    * @param {int} byte3 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt9F&gt&ltExt_OPC&gt&ltbyte1&gt&ltbyte2&gt&ltbyte3&gt
    */
    encodeEXTC3(Ext_OPC, byte1, byte2, byte3) {
        return this.header({MinPri: 3}) + '9F' + decToHex(Ext_OPC, 2) + decToHex(byte1, 2) + decToHex(byte2, 2) + decToHex(byte3, 2) + ';';
    }


    // A0 RDCC4
    // RDCC4 Format: <MjPri><MinPri=2><CANID>]<A0><REP><Byte0>..<Byte3>
    //
    decodeRDCC4(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RDCC4',
                'opCode': message.substr(7, 2),
                'repetitions': parseInt(message.substr(9, 2), 16),
                'byte0': parseInt(message.substr(11, 2), 16),
                'byte1': parseInt(message.substr(13, 2), 16),
                'byte2': parseInt(message.substr(15, 2), 16),
                'byte3': parseInt(message.substr(17, 2), 16),
                'text': "RDCC4 (A0) repetitions " + parseInt(message.substr(9, 2), 16) + 
					" byte0 " + parseInt(message.substr(11, 2), 16) +
					" byte1 " + parseInt(message.substr(13, 2), 16) +
					" byte2 " + parseInt(message.substr(15, 2), 16) +
					" byte3 " + parseInt(message.substr(17, 2), 16)
        }
    }
    /**
    * @desc opCode A0<br>
    * @param {int} repetitions 0 to 255
    * @param {int} byte0 0 to 255
    * @param {int} byte1 0 to 255
    * @param {int} byte2 0 to 255
    * @param {int} byte4 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&ltA0&gt&ltExt_OPC&gt&ltbyte0&gt&ltbyte1&gt&ltbyte2&gt&ltbyte3&gt
    */
    encodeRDCC4(repetitions, byte0, byte1, byte2, byte3) {
        return this.header({MinPri: 2}) + 'A0' + decToHex(repetitions, 2) + 
                            decToHex(byte0, 2) + 
                            decToHex(byte1, 2) + 
                            decToHex(byte2, 2) + 
                            decToHex(byte3, 2) + ';'
    }
    

    // A2 WCVS
    // WCVS Format: [<MjPri><MinPri=2><CANID>]<A2><Session><High CV#><LowCV#><mode><CVval>
    //
    decodeWCVS(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'WCVS',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'CV': parseInt(message.substr(11, 4), 16),
                'mode': parseInt(message.substr(15, 2), 16),
                'value': parseInt(message.substr(17, 2), 16),
                'text': "WCVS (A2) Session " + parseInt(message.substr(9, 2), 16) + 
					" CV " + parseInt(message.substr(11, 4), 16) +
					" mode " + parseInt(message.substr(15, 2), 16) +
					" Value " + parseInt(message.substr(17, 2), 16)
        }
    }
    /**
    * @desc opCode A2<br>
    * @param {int} session 0 to 255
    * @param {int} CV 1 to 65535
    * @param {int} mode 2 to 255
    * @param {int} value 3 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&ltA2&gt&session&gt&ltHigh CV#&gt&ltLow CV#&gt&ltmode&gt&ltvalue3&gt
    */
    encodeWCVS(session, CV, mode, value) {
        return this.header({MinPri: 2}) + 'A2' + decToHex(session, 2) + 
                            decToHex(CV, 4) + 
                            decToHex(mode, 2) + 
                            decToHex(value, 2) + ';'
    }
    

    // AB HEARTB
    // HEARTB Format: [<MjPri><MinPri><CANID>]<0xAB><NodeNumberHi><NodeNumberlo<SequenceCnt><StatusByte1><StatusByte2>
    //
    decodeHEARTB(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'HEARTB',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'SequenceCount': parseInt(message.substr(13, 2), 16),
                'StatusByte1': parseInt(message.substr(15, 2), 16),
                'StatusByte2': parseInt(message.substr(17, 2), 16),
                'text': "HEARTB (AB) nodeNumber " + parseInt(message.substr(9, 4), 16) + 
					" SequenceCount " + parseInt(message.substr(13, 2), 16) +
					" StatusByte1 " + parseInt(message.substr(15, 2), 16) +
					" StatusByte2 " + parseInt(message.substr(17, 2), 16)
        }
    }
    /**
    * @desc opCode AB<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} SequenceCount 0 to 255
    * @param {int} StatusByte1 2 to 255
    * @param {int} StatusByte2 3 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&ltAB&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltSequenceCnt#&gt&ltStatusByte1#&gt&StatusByte2&gt
    */
    encodeHEARTB(nodeNumber, SequenceCount, StatusByte1, StatusByte2) {
        return this.header({MinPri: 3}) + 'AB' + decToHex(nodeNumber, 4) + 
                            decToHex(SequenceCount, 2) + 
                            decToHex(StatusByte1, 2) + 
                            decToHex(StatusByte2, 2) + ';'
    }
    

    // AC SD
    // SD Format: [<MjPri><MinPri=3><CANID>]<AC><NN hi><NN lo><ServiceIndex><ServiceType><ServiceVersion>
    //
    decodeSD(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'SD',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'ServiceIndex': parseInt(message.substr(13, 2), 16),
                'ServiceType': parseInt(message.substr(15, 2), 16),
                'ServiceVersion': parseInt(message.substr(17, 2), 16),
                'text': "SD (AC) Node Number " + parseInt(message.substr(9, 4), 16) + 
					" ServiceIndex " + parseInt(message.substr(13, 2), 16) +
					" ServiceType " + parseInt(message.substr(15, 2), 16) +
					" ServiceVersion " + parseInt(message.substr(17, 2), 16)
        }
    }
    /**
    * @desc opCode AC<br>
    * @param {int} nodeNumber number 0 to 65535
    * @param {int} ServiceIndex number 0 to 255
    * @param {int} ServiceType number 0 to 255
    * @param {int} ServiceVersion number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltAC&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltServiceIndex&gt&ltServiceType&gt&ltServiceVersion&gt
    */
    encodeSD(nodeNumber, ServiceIndex, ServiceType, ServiceVersion) {
        return this.header({MinPri: 3}) + 'AC' + decToHex(nodeNumber, 4) + decToHex(ServiceIndex, 2) + decToHex(ServiceType, 2) + decToHex(ServiceVersion, 2) + ';'
    }
    

    // AF GRSP
    // GRSP Format: [<MjPri><MinPri><CANID>]<0xAF><NodeNumberHi><NodeNumberlo<requestOpCode><serviceType><result>
    //
    decodeGRSP(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'GRSP',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'requestOpCode': message.substr(13, 2),
                'serviceType': parseInt(message.substr(15, 2), 16),
                'result': parseInt(message.substr(17, 2), 16),
                'text': "GRSP (AF) nodeNumber " + parseInt(message.substr(9, 4), 16) + 
					" requestOpCode " + message.substr(13, 2) +
					" serviceType " + parseInt(message.substr(15, 2), 16) +
					" result " + parseInt(message.substr(17, 2), 16)
        }
    }
    /**
    * @desc opCode AF<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {string} requestOpCode '00' to 'FF' (hex encoded 0-255)
    * @param {int} serviceType 2 to 255
    * @param {int} result 3 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&ltAF&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltrequestOpCode&gt&ltserviceType&gt&ltresult&gt
    */
    encodeGRSP(nodeNumber, requestOpCode, serviceType, result) {
        return this.header({MinPri: 3}) + 'AF' + decToHex(nodeNumber, 4) + 
                            requestOpCode.substr(0, 2) + 
                            decToHex(serviceType, 2) + 
                            decToHex(result, 2) + ';'
    }
    

    // B0 ACON1
	// ACON1 Format: [<MjPri><MinPri=3><CANID>]<B0><NN hi><NN lo><EN hi><EN lo><data1>
    //
    decodeACON1(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ACON1',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'data1': parseInt(message.substr(17, 2), 16),
                'text': "ACON1 (B0) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16)
        }
    }
    /**
    * @desc opCode B0<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltB0&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt&ltdata1&gt
    */
    encodeACON1(nodeNumber, eventNumber, data1) {
        return this.header({MinPri: 3}) + 'B0' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + ';';
    }


    // B1 ACOF1
	// ACOF1 Format: [<MjPri><MinPri=3><CANID>]<B1><NN hi><NN lo><EN hi><EN lo><data1>
    //
    decodeACOF1(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ACOF1',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'data1': parseInt(message.substr(17, 2), 16), 
                'text': "ACOF1 (B1) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16)
        }
    }
    /**
    * @desc opCode B1<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltB1&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt&ltdata1&gt
    */
    encodeACOF1(nodeNumber, eventNumber, data1) {
        return this.header({MinPri: 3}) + 'B1' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + ';';
    }


    // B2 REQEV
	// REQEV Format: [<MjPri><MinPri=3><CANID>]<B2><NN hi><NN lo><EN hi><EN lo><EV# >
    //
    decodeREQEV(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'REQEV',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'eventVariableIndex': parseInt(message.substr(17, 2), 16),
                'text': "REQEV (B2) nodeNumber " + parseInt(message.substr(9, 4), 16) +
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
					" eventVariableIndex " + parseInt(message.substr(17, 2), 16)
        }
    }
    /**
    * @desc opCode B2<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @param {int} eventVariableIndex 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltB2&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt&lteventVariableIndex&gt
    */
    encodeREQEV(nodeNumber, eventNumber, eventVariableIndex) {
        return this.header({MinPri: 3}) + 'B2' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) + decToHex(eventVariableIndex, 2) + ';';
    }


    // B3 ARON1
	// ARON1 Format: [<MjPri><MinPri=3><CANID>]<B3><NN hi><NN lo><EN hi><EN lo><data1>
    //
    decodeARON1(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ARON1',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'data1': parseInt(message.substr(17, 2), 16),
                'text': "ARON1 (B3) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16)
        }
    }
    /**
    * @desc opCode B3<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltB3&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt&ltdata1&gt
    */
    encodeARON1(nodeNumber, eventNumber, data1) {
        return this.header({MinPri: 3}) + 'B3' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + ';';
    }


    // B4 AROF1
	// AROF1 Format: [<MjPri><MinPri=3><CANID>]<B4><NN hi><NN lo><EN hi><EN lo><data1>
    //
    decodeAROF1(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'AROF1',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'data1': parseInt(message.substr(17, 2), 16),
                'text': "AROF1 (B4) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16)
        }
    }
    /**
    * @desc opCode B4<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltB4&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt&ltdata1&gt
    */
    encodeAROF1(nodeNumber, eventNumber, data1) {
        return this.header({MinPri: 3}) + 'B4' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + ';';
    }


    // B5 NEVAL
    // NEVAL Format: [<MjPri><MinPri=3><CANID>]<B5><NN hi><NN lo><EN#><EV#><EVval>
    //
    decodeNEVAL(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NEVAL',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'eventIndex': parseInt(message.substr(13, 2), 16),
                'eventVariableIndex': parseInt(message.substr(15, 2), 16),
                'eventVariableValue': parseInt(message.substr(17, 2), 16),
                'text': "NEVAL (B5) NodeId " + parseInt(message.substr(9, 4), 16) + 
					" Event Index " + parseInt(message.substr(13, 2), 16) + 
					" Event Variable Index " + parseInt(message.substr(15, 2), 16) + 
					" Event Variable Value " + parseInt(message.substr(17, 2), 16)
        }
    }
    /**
    * @desc opCode B5<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventIndex 0 to 255
    * @param {int} eventVariableIndex 0 to 255
    * @param {int} eventVariableValue 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltB5&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventIndex&gt&lteventVariableIndex&gt&lteventVariableValue&gt
    */
    encodeNEVAL(nodeNumber, eventIndex, eventVariableIndex, eventVariableValue) {
        return this.header({MinPri: 3}) + 'B5' + decToHex(nodeNumber, 4) + decToHex(eventIndex, 2) + decToHex(eventVariableIndex, 2) + decToHex(eventVariableValue, 2) + ';'
    }


    // B6 PNN
    // PNN Format: [<MjPri><MinPri=3><CANID>]<B6><NN Hi><NN Lo><Manuf Id><Module Id><Flags>
    //
    decodePNN(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'PNN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'manufacturerId': parseInt(message.substr(13, 2), 16), 
                'moduleId': parseInt(message.substr(15, 2), 16), 
                'flags': parseInt(message.substr(17, 2), 16),
                'text': "PNN (B6) Node " + parseInt(message.substr(9, 4), 16) + 
					" Manufacturer Id " + parseInt(message.substr(13, 2), 16) + 
					" Module Id " + parseInt(message.substr(15, 2), 16) + 
					" Flags " + parseInt(message.substr(17, 2), 16)
        }
    }
    /**
    * @desc opCode B6<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} manufacturerId 0 to 255
    * @param {int} moduleId 0 to 255
    * @param {int} flags 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltB6&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltmanufacturerId&gt&ltmoduleId&gt&ltflags&gt
    */
    encodePNN(nodeNumber, manufacturerId, moduleId, flags) {
        return this.header({MinPri: 3}) + 'B6' + decToHex(nodeNumber, 4) + decToHex(manufacturerId, 2) + decToHex(moduleId, 2) + decToHex(flags, 2) + ';'
    }


    // B8 ASON1
    // ASON1 Format: [<MjPri><MinPri=3><CANID>]<B8><NN hi><NN lo><DN hi><DN lo><data1>
    //
    decodeASON1(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ASON1',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'data1': parseInt(message.substr(17, 2), 16),
                'text': "ASON1 (B8) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16)
        }
    }
    /**
    * @desc opCode B8<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltB8&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt&ltdata1&gt
    */
    encodeASON1(nodeNumber, deviceNumber, data1) {
        return this.header({MinPri: 3}) + 'B8' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + ';';
    }


    // B9 ASOF1
	// ASOF1 Format: [<MjPri><MinPri=3><CANID>]<B9><NN hi><NN lo><DN hi><DN lo><data1>
    //
    decodeASOF1(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ASOF1',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'data1': parseInt(message.substr(17, 2), 16),
                'text': "ASOF1 (B9) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16)
        }
    }
    /**
    * @desc opCode B9<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltB9&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt&ltdata1&gt
    */
    encodeASOF1(nodeNumber, deviceNumber, data1) {
        return this.header({MinPri: 3}) + 'B9' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + ';';
    }


    // BD ARSON1
    // ARSON1 Format: [<MjPri><MinPri=3><CANID>]<BD><NN hi><NN lo><EN hi><EN lo><data1>
    //
    decodeARSON1(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ARSON1',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'data1': parseInt(message.substr(17, 2), 16),
                'text': "ARSON1 (BD) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16)
        }
    }
    /**
    * @desc opCode BD<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltBD&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt&ltdata1&gt
    */
    encodeARSON1(nodeNumber, deviceNumber, data1) {
        return this.header({MinPri: 3}) + 'BD' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + ';';
    }


    // BE ARSOF1
    // ARSOF1 Format: [<MjPri><MinPri=3><CANID>]<BE><NN hi><NN lo><EN hi><EN lo><data1>
    //
    decodeARSOF1(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ARSOF1',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'data1': parseInt(message.substr(17, 2), 16),
                'text': "ARSOF1 (BE) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16)
        }
    }
     /**
    * @desc opCode BE<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltBE&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt&ltdata1&gt
    */
   encodeARSOF1(nodeNumber, deviceNumber, data1) {
        return this.header({MinPri: 3}) + 'BE' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + ';';
    }


    // BF EXTC4
	// EXTC4 Format: [<MjPri><MinPri=3><CANID>]<BF><Ext_OPC><byte1><byte2><byte3><byte4>
    //
    decodeEXTC4(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'EXTC4',
                'opCode': message.substr(7, 2),
                'Ext_OPC': parseInt(message.substr(9, 2), 16), 
                'byte1': parseInt(message.substr(11, 2), 16),
                'byte2': parseInt(message.substr(13, 2), 16),
                'byte3': parseInt(message.substr(15, 2), 16),
                'byte4': parseInt(message.substr(17, 2), 16),
                'text': "EXTC4 (BF) Ext_OPC " + parseInt(message.substr(9, 2), 16) + 
					" byte1 " + parseInt(message.substr(11, 4), 16) +
					" byte2 " + parseInt(message.substr(13, 4), 16) +
					" byte3 " + parseInt(message.substr(15, 4), 16) +
					" byte4 " + parseInt(message.substr(17, 4), 16)
        }
    }
    /**
    * @desc opCode BF<br>
    * @param {int} Ext_OPC 0 to 255
    * @param {int} byte1 0 to 255
    * @param {int} byte2 0 to 255
    * @param {int} byte3 0 to 255
    * @param {int} byte4 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltBF&gt&ltExt_OPC&gt&ltbyte1&gt&ltbyte2&gt&ltbyte3&gt&ltbyte4&gt
    */
    encodeEXTC4(Ext_OPC, byte1, byte2, byte3, byte4) {
        return this.header({MinPri: 3}) + 'BF' + decToHex(Ext_OPC, 2) + 
                            decToHex(byte1, 2) + 
                            decToHex(byte2, 2) + 
                            decToHex(byte3, 2) + 
                            decToHex(byte4, 2) + ';';
    }


    // C0 RDCC5
    // RDCC5 Format: <MjPri><MinPri=2><CANID>]<A0><REP><Byte0>..<Byte4>
    //
    decodeRDCC5(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RDCC5',
                'opCode': message.substr(7, 2),
                'repetitions': parseInt(message.substr(9, 2), 16),
                'byte0': parseInt(message.substr(11, 2), 16),
                'byte1': parseInt(message.substr(13, 2), 16),
                'byte2': parseInt(message.substr(15, 2), 16),
                'byte3': parseInt(message.substr(17, 2), 16),
                'byte4': parseInt(message.substr(19, 2), 16),
                'text': "RDCC5 (C0) repetitions " + parseInt(message.substr(9, 2), 16) + 
					" byte0 " + parseInt(message.substr(11, 2), 16) +
					" byte1 " + parseInt(message.substr(13, 2), 16) +
					" byte2 " + parseInt(message.substr(15, 2), 16) +
					" byte3 " + parseInt(message.substr(17, 2), 16) +
					" byte4 " + parseInt(message.substr(19, 2), 16)
        }
    }
    /**
    * @desc opCode C0<br>
    * @param {int} repetitions 0 to 255
    * @param {int} byte0 0 to 255
    * @param {int} byte1 0 to 255
    * @param {int} byte2 0 to 255
    * @param {int} byte3 0 to 255
    * @param {int} byte4 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&ltC0&gt&ltExt_OPC&gt&ltbyte0&gt&ltbyte1&gt&ltbyte2&gt&ltbyte3&gt&ltbyte4&gt
    */
    encodeRDCC5(repetitions, byte0, byte1, byte2, byte3, byte4) {
        return this.header({MinPri: 2}) + 'C0' + decToHex(repetitions, 2) + 
                            decToHex(byte0, 2) + 
                            decToHex(byte1, 2) + 
                            decToHex(byte2, 2) + 
                            decToHex(byte3, 2) + 
                            decToHex(byte4, 2) + ';'
    }
    

    // C1 WCVOA
    // WCVOA Format: [<MjPri><MinPri=2><CANID>]<C1><AddrH><AddrL><High CV#><Low CV#><mode><Val>
    //
    decodeWCVOA(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'WCVOA',
                'opCode': message.substr(7, 2),
                'address': parseInt(message.substr(9, 4), 16),
                'CV': parseInt(message.substr(13, 4), 16),
                'mode': parseInt(message.substr(17, 2), 16),
                'value': parseInt(message.substr(19, 2), 16),
                'text': "WCVOA (C1) address " + parseInt(message.substr(9, 4), 16) + 
					" CV " + parseInt(message.substr(13, 4), 16) +
					" mode " + parseInt(message.substr(17, 2), 16) +
					" value " + parseInt(message.substr(19, 2), 16)
        }
    }
    /**
    * @desc opCode C1<br>
    * @param {int} address number 0 to 65535
    * @param {int} CV number 0 to 65535
    * @param {int} mode number 0 to 255
    * @param {int} value number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&ltC1&gt&ltsession&gt&ltCV hi&gt&ltCV lo&gt&ltmode&gt&ltvalue&gt
    */
    encodeWCVOA(address, CV, mode, value) {
        return this.header({MinPri: 2}) + 'C1' + decToHex(address, 4) + decToHex(CV, 4) + decToHex(mode, 2) + decToHex(value, 2) + ';'
    }
    

    // C2 CABDAT
    // CABDAT Format: [<MjPri><MinPri=2><CANID>]<0xC2><addrH><addrL><datcode><aspect1><aspect2><speed>
    //
    decodeCABDAT(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'CABDAT',
                'opCode': message.substr(7, 2),
                'address': parseInt(message.substr(9, 4), 16),
                'datcode': parseInt(message.substr(13, 2), 16),
                'aspect1': parseInt(message.substr(15, 2), 16),
                'aspect2': parseInt(message.substr(17, 2), 16),
                'speed': parseInt(message.substr(19, 2), 16),
                'text': "CABDAT (C2) address " + parseInt(message.substr(9, 4), 16) + 
					" datcode " + parseInt(message.substr(13, 2), 16) +
					" aspect1 " + parseInt(message.substr(13, 2), 16) +
					" aspect2 " + parseInt(message.substr(17, 2), 16) +
					" speed " + parseInt(message.substr(19, 2), 16)
        }
    }
    /**
    * @desc opCode C2<br>
    * @param {int} address number 0 to 65535
    * @param {int} datcode number 0 to 255
    * @param {int} aspect1 number 0 to 255
    * @param {int} aspect2 number 0 to 255
    * @param {int} speed number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&ltC2&gt&ltaddrH&gt&ltaddrL&gt&ltdatcode&gt&ltaspect1&gt&ltaspect1&gt&ltspeed&gt
    */
    encodeCABDAT(address, datcode, aspect1, aspect2, speed) {
        return this.header({MinPri: 2}) + 'C2' + decToHex(address, 4) + decToHex(datcode, 2) + decToHex(aspect1, 2) + decToHex(aspect2, 2) + decToHex(speed, 2) + ';'
    }
    

    // C7 DGN
    // DGN Format: [<MjPri><MinPri=3><CANID>]<C7><NN Hi><NN Lo><ServiceIndex><DiagnosticCode><DiagnosticValue Hi><DiagnosticValue Lo>
    //
    decodeDGN(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'DGN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'ServiceIndex': parseInt(message.substr(13, 2), 16), 
                'DiagnosticCode': parseInt(message.substr(15, 2), 16), 
                'DiagnosticValue': parseInt(message.substr(17, 4), 16),
                'text': "DGN (C7) Node " + parseInt(message.substr(9, 4), 16) + 
					" ServiceIndex " + parseInt(message.substr(13, 2), 16) + 
					" DiagnosticCode " + parseInt(message.substr(15, 2), 16) + 
					" DiagnosticValue " + parseInt(message.substr(17, 4), 16)
        }
    }
    /**
    * @desc opCode C7<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} ServiceIndex 0 to 255
    * @param {int} DiagnosticCode  0 to 255
    * @param {int} DiagnosticValue 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltC7&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltServiceIndex&gt&ltDiagnosticCode&gt&ltDiagnosticValue Hi&gt&ltDiagnosticValue Lo&gt
    */
    encodeDGN(nodeNumber, ServiceIndex, DiagnosticCode, DiagnosticValue) {
        return this.header({MinPri: 3}) + 'C7' + decToHex(nodeNumber, 4) + decToHex(ServiceIndex, 2) + decToHex(DiagnosticCode, 2) + decToHex(DiagnosticValue, 4) + ';'
    }


    // CF FCLK
    // FCLK Format: <MjPri><MinPri=3><CANID>]<CF><mins><hrs><wdmon><div><mday><temp>
    //
    decodeFCLK(message) {
        var minutes = parseInt(message.substr(9, 2), 16);
        var hours = parseInt(message.substr(11, 2), 16);
        var wdmon = parseInt(message.substr(13, 2), 16);
        var dayOfWeek = parseInt(message.substr(13, 2), 16)%16;
        var month = parseInt(message.substr(13, 2), 16) >> 4;
        var div = parseInt(message.substr(15, 2), 16);
        var dayOfMonth = parseInt(message.substr(17, 2), 16);
        var temperature = parseInt(message.substr(19, 2), 16);
        // parseInt can't tell if hex is a signed value
        // so need to convert it to two's complement
        if (temperature > 127) {temperature = temperature - 256}
        var output = {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'FCLK',
                'opCode': message.substr(7, 2),
                'minutes': minutes,
                'hours': hours,
                'wdmon': wdmon,
                'dayOfWeek': dayOfWeek,
                'month': month,
                'div': div,
                'dayOfMonth': dayOfMonth,
                'temperature': temperature,
                'text': "FCLK (CF) minutes " + minutes + 
					" hours " + hours +
					" dayOfMonth " + dayOfMonth +
                    " month " + month +
                    " dayOfWeek " + dayOfWeek +
					" wdmon " + wdmon +
					" div " + div +
					" temperature " + temperature
        }
        return output;
    }
    /**
    * @desc opCode CF<br>
    * @param {int} minutes 0 to 59
    * @param {int} hours 0 to 23
    * @param {int} day of week 1 to 7 (1=Sun, 2=Mon etc)
    * @param {int} month 1 to 12 (1=Jan, 2=Feb etc)
    * @param {int} div Set to 0 for freeze, 1 for real time
    * @param {int} mday - day of the month 1-31
    * @param {int} temperature - twos complement -127 to +127
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltCF&gt&ltmins&gt&lthrs&gt&ltwdmon&gt&ltdiv&gt&ltmday&gt&lttemp&gt
    */
    encodeFCLK(minutes, hours, dayOfWeek, dayOfMonth, month, div, temperature) {
        // wdmon bits 0-3 are the weekday (1=Sun, 2=Mon etc), bits 4-7 are the month (1=Jan, 2=Feb etc)
        // the input fields may be strings, so take care with maths on these fields
        var wdmon = (month << 4) + (dayOfWeek & 0xF);
        return this.header({MinPri: 3}) + 'CF' + 
                            decToHex(minutes, 2) + 
                            decToHex(hours, 2) + 
                            decToHex(wdmon, 2) + 
                            decToHex(div, 2) + 
                            decToHex(dayOfMonth, 2) + 
                            decToHex(temperature, 2) + ';'
    }
    

    // D0 ACON2
	// ACON2 Format: [<MjPri><MinPri=3><CANID>]<D0><NN hi><NN lo><EN hi><EN lo><data1><data2>
    //
    decodeACON2(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ACON2',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'data1': parseInt(message.substr(17, 2), 16), 
                'data2': parseInt(message.substr(19, 2), 16), 
                'text': "ACON2 (D0) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16)
        }
    }
    /**
    * @desc opCode D0<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltD0&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt&ltdata1&gt&ltdata2&gt
    */
    encodeACON2(nodeNumber, eventNumber, data1, data2) {
        return this.header({MinPri: 3}) + 'D0' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + ';';
    }


    // D1 ACOF2
	// ACOF2 Format: [<MjPri><MinPri=3><CANID>]<D1><NN hi><NN lo><EN hi><EN lo><data1><data2>
    //
    decodeACOF2(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ACOF2',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'data1': parseInt(message.substr(17, 2), 16), 
                'data2': parseInt(message.substr(19, 2), 16), 
                'text': "ACOF2 (D1) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16)
        }
    }
    /**
    * @desc opCode D1<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltD1&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt&ltdata1&gt&ltdata2&gt
    */
    encodeACOF2(nodeNumber, eventNumber, data1, data2) {
        return this.header({MinPri: 3}) + 'D1' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + ';';
    }


    // D2 EVLRN
	// EVLRN Format: [<MjPri><MinPri=3><CANID>]<D2><NN hi><NN lo><EN hi><EN lo><EV#><EV val>
    //
    decodeEVLRN(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'EVLRN',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'eventVariableIndex': parseInt(message.substr(17, 2), 16),
                'eventVariableValue': parseInt(message.substr(19, 2), 16),
                'text': "EVLRN (D2) nodeNumber " + parseInt(message.substr(9, 4), 16) + 
                    " eventNumber " + parseInt(message.substr(13, 4), 16) +
					" Event Variable Index " + parseInt(message.substr(17, 2), 16) + 
					" Event Variable Value " + parseInt(message.substr(19, 2), 16)
        }
    }
    /**
    * @desc opCode D2<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @param {int} eventVariableIndex 0 to 255
    * @param {int} eventVariableValue 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltD2&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt&lteventVariableIndex&gt&lteventVariableValue&gt
    */
    encodeEVLRN(nodeNumber, eventNumber, eventVariableIndex, eventVariableValue) {
        return this.header({MinPri: 3}) + 'D2' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) + decToHex(eventVariableIndex, 2) + decToHex(eventVariableValue, 2) + ';'
    }
    

    // D3 EVANS
	// EVANS Format: [<MjPri><MinPri=3><CANID>]<D3><NN hi><NN lo><EN hi><EN lo><EV#><EV val>
    //
    decodeEVANS(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'EVANS',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'eventVariableIndex': parseInt(message.substr(17, 2), 16),
                'eventVariableValue': parseInt(message.substr(19, 2), 16),
                'text': "EVANS (D3) nodeNumber " + parseInt(message.substr(9, 4), 16) + 
                    " eventNumber " + parseInt(message.substr(13, 4), 16) + 
					" Event Variable Index " + parseInt(message.substr(17, 2), 16) + 
					" Event Variable Value " + parseInt(message.substr(19, 2), 16)
        }
    }
    /**
    * @desc opCode D3<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @param {int} eventVariableIndex 0 to 255
    * @param {int} eventVariableValue 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltD3&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt&lteventVariableIndex&gt&lteventVariableValue&gt
    */
    encodeEVANS(nodeNumber, eventNumber, eventVariableIndex, eventVariableValue) {
        return this.header({MinPri: 3}) + 'D3' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) + decToHex(eventVariableIndex, 2) + decToHex(eventVariableValue, 2) + ';'
    }
    

    // D4 ARON2
	// ARON2 Format: [<MjPri><MinPri=3><CANID>]<D4><NN hi><NN lo><EN hi><EN lo><data1><data2>
    //
    decodeARON2(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ARON2',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'data1': parseInt(message.substr(17, 2), 16), 
                'data2': parseInt(message.substr(19, 2), 16), 
                'text': "ARON2 (D4) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16)
        }
    }
    /**
    * @desc opCode D4<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltD4&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt&ltdata1&gt&ltdata2&gt
    */
    encodeARON2(nodeNumber, eventNumber, data1, data2) {
        return this.header({MinPri: 3}) + 'D4' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + ';';
    }


    // D5 AROF2
	// AROF2 Format: [<MjPri><MinPri=3><CANID>]<D5><NN hi><NN lo><EN hi><EN lo><data1><data2>
    //
    decodeAROF2(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'AROF2',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'data1': parseInt(message.substr(17, 2), 16), 
                'data2': parseInt(message.substr(19, 2), 16), 
                'text': "AROF2 (D5) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16)
        }
    }
     /**
    * @desc opCode D5<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltD5&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt&ltdata1&gt&ltdata2&gt
    */
   encodeAROF2(nodeNumber, eventNumber, data1, data2) {
        return this.header({MinPri: 3}) + 'D5' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + ';';
    }


    // D8 ASON2
	// ASON2 Format: [<MjPri><MinPri=3><CANID>]<D8><NN hi><NN lo><EN hi><EN lo><data1><data2>
    //
    decodeASON2(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ASON2',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'data1': parseInt(message.substr(17, 2), 16), 
                'data2': parseInt(message.substr(19, 2), 16), 
                'text': "ASON2 (D8) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16)
        }
    }
    /**
    * @desc opCode D8<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltD8&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt&ltdata1&gt&ltdata2&gt
    */
    encodeASON2(nodeNumber, deviceNumber, data1, data2) {
        return this.header({MinPri: 3}) + 'D8' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + ';';
    }


    // D9 ASOF2
	// ASOF2 Format: [<MjPri><MinPri=3><CANID>]<D9><NN hi><NN lo><EN hi><EN lo><data1><data2>
    //
    decodeASOF2(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ASOF2',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'data1': parseInt(message.substr(17, 2), 16), 
                'data2': parseInt(message.substr(19, 2), 16), 
                'text': "ASOF2 (D9) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16)
        }
    }
    /**
    * @desc opCode D9<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltD9&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt&ltdata1&gt&ltdata2&gt
    */
    encodeASOF2(nodeNumber, deviceNumber, data1, data2) {
        return this.header({MinPri: 3}) + 'D9' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + ';';
    }


    // DD ARSON2
	// ARSON2 Format: [<MjPri><MinPri=3><CANID>]<DD><NN hi><NN lo><EN hi><EN lo><data1><data2>
    //
    decodeARSON2(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ARSON2',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'data1': parseInt(message.substr(17, 2), 16), 
                'data2': parseInt(message.substr(19, 2), 16), 
                'text': "ARSON2 (DD) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16)
        }
    }
    /**
    * @desc opCode DD<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltDD&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt&ltdata1&gt&ltdata2&gt
    */
    encodeARSON2(nodeNumber, deviceNumber, data1, data2) {
        return this.header({MinPri: 3}) + 'DD' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + ';';
    }


    // DE ARSOF2
	// ARSOF2 Format: [<MjPri><MinPri=3><CANID>]<DE><NN hi><NN lo><EN hi><EN lo><data1><data2>
    //
    decodeARSOF2(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ARSOF2',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'data1': parseInt(message.substr(17, 2), 16), 
                'data2': parseInt(message.substr(19, 2), 16), 
                'text': "ARSOF2 (DE) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16)
        }
    }
    /**
    * @desc opCode DE<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltDE&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt&ltdata1&gt&ltdata2&gt
    */
    encodeARSOF2(nodeNumber, deviceNumber, data1, data2) {
        return this.header({MinPri: 3}) + 'DE' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + ';';
    }


    // DF EXTC5
	// EXTC5 Format: [<MjPri><MinPri=3><CANID>]<DF><Ext_OPC><byte1><byte2><byte3><byte4><byte5>
    //
    decodeEXTC5(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'EXTC5',
                'opCode': message.substr(7, 2),
                'Ext_OPC': parseInt(message.substr(9, 2), 16), 
                'byte1': parseInt(message.substr(11, 2), 16),
                'byte2': parseInt(message.substr(13, 2), 16),
                'byte3': parseInt(message.substr(15, 2), 16),
                'byte4': parseInt(message.substr(17, 2), 16),
                'byte5': parseInt(message.substr(19, 2), 16),
                'text': "EXTC5 (DF) Ext_OPC " + parseInt(message.substr(9, 2), 16) + 
					" byte1 " + parseInt(message.substr(11, 4), 16) +
					" byte2 " + parseInt(message.substr(13, 4), 16) +
					" byte3 " + parseInt(message.substr(15, 4), 16) +
					" byte4 " + parseInt(message.substr(17, 4), 16) +
					" byte5 " + parseInt(message.substr(19, 4), 16)
        }
    }
    /**
    * @desc opCode DF<br>
    * @param {int} Ext_OPC 0 to 255
    * @param {int} byte1 0 to 255
    * @param {int} byte2 0 to 255
    * @param {int} byte3 0 to 255
    * @param {int} byte4 0 to 255
    * @param {int} byte5 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltDF&gt&ltExt_OPC&gt&ltbyte1&gt&ltbyte2&gt&ltbyte3&gt&ltbyte4&gt&ltbyte5&gt
    */
    encodeEXTC5(Ext_OPC, byte1, byte2, byte3, byte4, byte5) {
        return this.header({MinPri: 3}) + 'DF' + decToHex(Ext_OPC, 2) + 
                            decToHex(byte1, 2) + 
                            decToHex(byte2, 2) + 
                            decToHex(byte3, 2) + 
                            decToHex(byte4, 2) + 
                            decToHex(byte5, 2) + ';';
    }


    // E0 RDCC6
    // RDCC6 Format: <MjPri><MinPri=2><CANID>]<A0><REP><Byte0>..<Byte5>
    //
    decodeRDCC6(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'RDCC6',
                'opCode': message.substr(7, 2),
                'repetitions': parseInt(message.substr(9, 2), 16),
                'byte0': parseInt(message.substr(11, 2), 16),
                'byte1': parseInt(message.substr(13, 2), 16),
                'byte2': parseInt(message.substr(15, 2), 16),
                'byte3': parseInt(message.substr(17, 2), 16),
                'byte4': parseInt(message.substr(19, 2), 16),
                'byte5': parseInt(message.substr(21, 2), 16),
                'text': "RDCC6 (E0) repetitions " + parseInt(message.substr(9, 2), 16) + 
					" byte0 " + parseInt(message.substr(11, 2), 16) +
					" byte1 " + parseInt(message.substr(13, 2), 16) +
					" byte2 " + parseInt(message.substr(15, 2), 16) +
					" byte3 " + parseInt(message.substr(17, 2), 16) +
					" byte4 " + parseInt(message.substr(19, 2), 16) +
					" byte5 " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode E0<br>
    * @param {int} repetitions 0 to 255
    * @param {int} byte0 0 to 255
    * @param {int} byte1 0 to 255
    * @param {int} byte2 0 to 255
    * @param {int} byte3 0 to 255
    * @param {int} byte4 0 to 255
    * @param {int} byte5 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&ltE0&gt&ltrepetitions&gt&ltbyte0&gt&ltbyte1&gt&ltbyte2&gt&ltbyte3&gt&ltbyte4&gt&ltbyte5&gt
    */
    encodeRDCC6(repetitions, byte0, byte1, byte2, byte3, byte4, byte5) {
        return this.header({MinPri: 2}) + 'E0' + decToHex(repetitions, 2) + 
                            decToHex(byte0, 2) + 
                            decToHex(byte1, 2) + 
                            decToHex(byte2, 2) + 
                            decToHex(byte3, 2) + 
                            decToHex(byte4, 2) + 
                            decToHex(byte5, 2) + ';'
    }
    

    // E1 PLOC
    // PLOC Format: [<MjPri><MinPri=2><CANID>]<E1><Session><AddrH><AddrL><Speed/Dir><Fn1><Fn2><Fn3>
    //
    decodePLOC(message) {
        var speedDir = parseInt(message.substr(15, 2), 16)
        var direction = (speedDir > 127) ? 'Forward' : 'Reverse';
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'PLOC',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'address': parseInt(message.substr(11, 4), 16),
                'speed': speedDir % 128,
                'direction': direction,
                'Fn1': parseInt(message.substr(17, 2), 16),
                'Fn2': parseInt(message.substr(19, 2), 16),
                'Fn3': parseInt(message.substr(21, 2), 16),
                'text': "PLOC (E1) Session " + parseInt(message.substr(9, 2), 16) + 
					" Address " + parseInt(message.substr(11, 4), 16) +
					" Speed/Dir " + speedDir % 128 +
					" Direction " + direction +
					" Fn1 " + parseInt(message.substr(17, 2), 16) +
					" Fn2 " + parseInt(message.substr(19, 2), 16) +
					" Fn3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode E1<br>
    * @param {int} repetitions 0 to 255
    * @param {int} session 0 to 255
    * @param {int} address 0 to 65535
    * @param {int} speed number 0 to 127
    * @param {string} direction 'Reverse' or 'Forward' (defaults to 'Forward' if string not matching 'Reverse')
    * @param {int} Fn1 0 to 255
    * @param {int} Fn2 0 to 255
    * @param {int} Fn3 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&ltE1&gt&ltrepetitions&gt&ltsession&gt&ltaddress hi&gt&ltaddress lo&gt&ltSpeed/Dir&gt&ltFn1&gt&ltFn2&gt&ltFn3&gt
    */
    encodePLOC(session, address, speed, direction, Fn1, Fn2, Fn3) {
        var speedDir = (speed & 0x7F) + parseInt((direction.toUpperCase() == 'REVERSE') ? 0 : 128)
        return this.header({MinPri: 2}) + 'E1' + decToHex(session, 2) + decToHex(address, 4) + decToHex(speedDir, 2) + decToHex(Fn1, 2) + decToHex(Fn2, 2) + decToHex(Fn3, 2) + ';';
    }
    

    // E2 NAME
    // NAME Format: [<MjPri><MinPri=3><CANID>]<E2><char1><char2><char3><char4><char5><char6><char7>
    //
    decodeNAME(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'NAME',
                'opCode': message.substr(7, 2),
                'name': hexToString(message.substr(9, 14)),
                'text': "NAME (E2) name " + hexToString(message.substr(9, 14)) 
        }
    }
    /**
    * @desc opCode E2<br>
    * @param {string} name 0 to 7 ASCII characters (will be right padded with spaces to 7 characters)
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&ltE2&gt&ltchar1&gt&ltchar2&gt&ltchar3&gt&ltchar4&gt&ltchar5&gt&ltchar6&gt&ltchar7&gt
    */
    encodeNAME(name) {
        return this.header({MinPri: 3}) + 'E2' + stringToHex(name.padEnd(7).substr(0,7)) + ';'
    }
    

    // E3 STAT
    // STAT Format: [<MjPri><MinPri=2><CANID>]<E3><NN hi><NN lo><CS num><flags>
    //               <Major rev><Minor rev><Build no.>   
    //
    decodeSTAT(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'STAT',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'CS': parseInt(message.substr(13, 2), 16),
                'flags': parseInt(message.substr(15, 2), 16),
                'major': parseInt(message.substr(17,2), 16),
                'minor': parseInt(message.substr(19, 2), 16),
                'build': parseInt(message.substr(21, 2), 16),
                'text': "STAT (E3) nodeNumber " + parseInt(message.substr(9, 4), 16) +
                                " CS " + parseInt(message.substr(13, 2), 16) +
                                " flags " + parseInt(message.substr(15, 2), 16) +
                                " major " + parseInt(message.substr(17, 2), 16) +
                                " minor " + parseInt(message.substr(19, 2), 16) +
                                " build " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode E3<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} CS 0 to 255
    * @param {int} flags 0 to 255
    * @param {int} major 0 to 255
    * @param {int} minor 0 to 255
    * @param {int} build 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&ltE3&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltCS&gt&ltflags&gt&ltmajor&gt&ltminor&gt&ltbuild&gt
    */
    encodeSTAT(nodeNumber, CS, flags, major, minor, build) {
        return this.header({MinPri: 2}) + 'E3'  + decToHex(nodeNumber, 4) +
                                            decToHex(CS, 2) +
                                            decToHex(flags, 2) +
                                            decToHex(major, 2) +
                                            decToHex(minor, 2) +
                                            decToHex(build, 2) + ';'
    }
    
    /**
    * E6 ENACK 
    * opcode (1 bytes), E6 ENACK,
    * NN (2 bytes) Module’s Node Number,
    * opcode (1 bytes), The opcode of the event being acknowledged,
    * EventNNh (1 bytes), The high byte of the event’s NN,
    * EventNNl (1 bytes), The low byte of the event’s NN,
    * EventENh (1 bytes), The high byte of the event’s EN,
    * EventENl (1 bytes), The low byte of the event’s EN
    **/
    decodeENACK(message) {
      return {'encoded': message,
              'ID_TYPE': 'S',
              'mnemonic': 'ENACK',
              'opCode': message.substr(7, 2),  
              'nodeNumber': parseInt(message.substr(9, 4), 16),
              'ackOpCode': message.substr(13, 2),  
              'eventIdentifier': message.substring(15, 23),
              'text': "ENACK (E6) nodeNumber " + parseInt(message.substr(9, 4), 16) +
                              " ackOpCode " + parseInt(message.substr(13, 2), 16) +
                              " eventIdentifier " + message.substring(15, 23)
      }
    }
    /**
    * @desc opCode E6<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {string} ackOpcode "00" to "FF"
    * @param {string} eventIdentifer "00000000" to "FFFFFFFF"
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    */
    encodeENACK(nodeNumber, ackOpCode, eventIdentifier) {
      // process ackOpCode - remove spaces, limit to 2 chars, and pad with 0's if less than two
      var processedAckOpCode = ackOpCode.trim().substring(0, 2).padStart(2, '0')
      // process eventIdentifier - remove spaces, limit to 8 chars, and pad with 0's if less than eight
      var processedEventIdentifier = eventIdentifier.trim().substring(0, 8).padStart(8, '0')
      return this.header({MinPri: 2}) + 'E6' + 
        decToHex(nodeNumber, 4) +
        processedAckOpCode +
        processedEventIdentifier + ';'
  }



    // E7 ESD
    // ESD Format: [<MjPri><MinPri=2><CANID>]<E7><NN hi><NN lo><ServiceIndex><ServiceIndex>
    //              <Data1><Data2><Data3>
    //
    decodeESD(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ESD',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'ServiceIndex': parseInt(message.substr(13, 2), 16),
                'ServiceType': parseInt(message.substr(15, 2), 16),
                'Data1': parseInt(message.substr(17,2), 16),
                'Data2': parseInt(message.substr(19, 2), 16),
                'Data3': parseInt(message.substr(21, 2), 16),
                'text': "ESD (E7) nodeNumber " + parseInt(message.substr(9, 4), 16) +
                                " ServiceIndex " + parseInt(message.substr(13, 2), 16) +
                                " ServiceType " + parseInt(message.substr(15, 2), 16) +
                                " Data1 " + parseInt(message.substr(17, 2), 16) +
                                " Data2 " + parseInt(message.substr(19, 2), 16) +
                                " Data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode E7<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} ServiceIndex 0 to 255
    * @param {int} ServiceType 0 to 255
    * @param {int} Data1 0 to 255
    * @param {int} Data2 0 to 255
    * @param {int} Data3 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&ltE7&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltServiceIndex&gt&ltData1&gt&ltData2&gt&ltData3&gt&ltData4&gt
    */
    encodeESD(nodeNumber, ServiceIndex, ServiceType, Data1, Data2, Data3) {
        return this.header({MinPri: 2}) + 'E7'  + decToHex(nodeNumber, 4) +
                                            decToHex(ServiceIndex, 2) +
                                            decToHex(ServiceType, 2) +
                                            decToHex(Data1, 2) +
                                            decToHex(Data2, 2) +
                                            decToHex(Data3, 2) + ';'
    }
    

    // E9 DTXC
    // DTXC Format: [<MjPri><MinPri=2><CANID>]
    //    <E9>
    //    <streamIdentifier>
    //    <sequenceNumber>  <0>                 <!=0>
    //                  <messageLen Hi>     <data 1>
    //                  <messageLen Lo>     <data 2>
    //                  <CRC Hi>            <data 3>
    //                  <CRC Lo>            <data 4>
    //                  <flags>             <data 5>
    //
    decodeDTXC(message) {
      var output = {}
      output['encoded'] = message
      output['ID_TYPE'] = 'S'
      output['mnemonic'] = 'DTXC'
      output['opCode'] = message.substr(7, 2)
      output['streamIdentifier'] = parseInt(message.substr(9, 2), 16)
      output['sequenceNumber'] = parseInt(message.substr(11, 2), 16)
      if (output.sequenceNumber == 0) {
        output['messageLength'] = parseInt(message.substr(13, 4), 16)
        output['CRC16'] = parseInt(message.substr(17, 4), 16)
        output['flags'] = parseInt(message.substr(21, 2), 16)
      } else {
        output['Data1'] = parseInt(message.substr(13, 2), 16)
        output['Data2'] = parseInt(message.substr(15, 2), 16)
        output['Data3'] = parseInt(message.substr(17, 2), 16)
        output['Data4'] = parseInt(message.substr(19, 2), 16)
        output['Data5'] = parseInt(message.substr(21, 2), 16)
      }
      output['text'] = JSON.stringify(output)
      return output
    }
    encodeDTXC_SEQ0(streamIdentifier, sequenceNumber, messageLength, CRC16, flags) {
      return this.header({MinPri: 3}) + 'E9' + 
        decToHex(streamIdentifier, 2) + 
        decToHex(sequenceNumber, 2) + 
        decToHex(messageLength, 4) + 
        decToHex(CRC16, 4) + 
        decToHex(flags, 2) + ';'
    }
    encodeDTXC(streamIdentifier, sequenceNumber, Data1, Data2, Data3, Data4, Data5) {
      return this.header({MinPri: 3}) + 'E9' + 
        decToHex(streamIdentifier, 2) + 
        decToHex(sequenceNumber, 2) + 
        decToHex(Data1, 2) + 
        decToHex(Data2, 2) + 
        decToHex(Data3, 2) + 
        decToHex(Data4, 2) + 
        decToHex(Data5, 2) + ';'
    }


    // EF PARAMS
    // PARAMS Format: [<MjPri><MinPri=3><CANID>]<EF><PARA 1><PARA 2><PARA 3><PARA 4><PARA 5><PARA 6><PARA 7>
    //
    decodePARAMS(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'PARAMS',
                'opCode': message.substr(7, 2),
                'param1': parseInt(message.substr(9, 2), 16),
                'param2': parseInt(message.substr(11, 2), 16),
                'param3': parseInt(message.substr(13, 2), 16),
                'param4': parseInt(message.substr(15, 2), 16),
                'param5': parseInt(message.substr(17, 2), 16),
                'param6': parseInt(message.substr(19, 2), 16),
                'param7': parseInt(message.substr(21, 2), 16),
                'text': "PARAMS (EF) param1 " + parseInt(message.substr(9, 2), 16) + 
					" param2 " + parseInt(message.substr(11, 2), 16) +
					" param3 " + parseInt(message.substr(13, 2), 16) +
					" param4 " + parseInt(message.substr(15, 2), 16) +
					" param5 " + parseInt(message.substr(17, 2), 16) +
					" param6 " + parseInt(message.substr(19, 2), 16) +
					" param7 " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode EF<br>
    * @param {int} param1 0 to 255
    * @param {int} param2 0 to 255
    * @param {int} param3 0 to 255
    * @param {int} param4 0 to 255
    * @param {int} param5 0 to 255
    * @param {int} param6 0 to 255
    * @param {int} param7 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltEF&gt&ltparam1&gt&ltparam2&gt&ltparam3&gt&ltparam4&gt&ltparam5&gt&ltparam6&gt&ltparam7&gt
    */
    encodePARAMS(param1, param2, param3, param4, param5, param6, param7) {
        return this.header({MinPri: 3}) + 'EF' + decToHex(param1, 2) + 
                            decToHex(param2, 2) + 
                            decToHex(param3, 2) + 
                            decToHex(param4, 2) + 
                            decToHex(param5, 2) + 
                            decToHex(param6, 2) + 
                            decToHex(param7, 2) + ';'
    }
    

    // F0 ACON3
	// ACON3 Format: [<MjPri><MinPri=3><CANID>]<F0><NN hi><NN lo><EN hi><EN lo><data1><data2><data3>
    //
    decodeACON3(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ACON3',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'data1': parseInt(message.substr(17, 2), 16), 
                'data2': parseInt(message.substr(19, 2), 16), 
                'data3': parseInt(message.substr(21, 2), 16),
                'text': "ACON3 (F0) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16) +
                    " data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode F0<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @param {int} data3 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltF0&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt&ltdata1&gt&ltdata2&gt&ltdata3&gt
    */
    encodeACON3(nodeNumber, eventNumber, data1, data2, data3) {
        return this.header({MinPri: 3}) + 'F0' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + decToHex(data3, 2) + ';';
    }


    // F1 ACOF3
	// ACOF3 Format: [<MjPri><MinPri=3><CANID>]<F1><NN hi><NN lo><EN hi><EN lo><data1><data2><data3>
    //
    decodeACOF3(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ACOF3',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'data1': parseInt(message.substr(17, 2), 16), 
                'data2': parseInt(message.substr(19, 2), 16), 
                'data3': parseInt(message.substr(21, 2), 16),
                'text': "ACOF3 (F1) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16) +
                    " data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode F1<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @param {int} data3 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltF1&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt&ltdata1&gt&ltdata2&gt&ltdata3&gt
    */
    encodeACOF3(nodeNumber, eventNumber, data1, data2, data3) {
        return this.header({MinPri: 3}) + 'F1' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + decToHex(data3, 2) + ';';
    }


    // F2 ENRSP
    // ENRSP Format: [<MjPri><MinPri=3><CANID>]<F2><NN hi><NN lo><EN3><EN2><EN1><EN0><EN#>
    //
    decodeENRSP(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ENRSP',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'eventIdentifier': message.substr(13, 8),
                'eventIndex': parseInt(message.substr(21, 2), 16),
                'text': "ENRSP (F2) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventIdentifier " + message.substr(13, 8) + 
					" Event Index " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode F2<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {string} eventIdentifier 8 digit hexadecimal string, with leading zero's
    * @param {int} eventIndex 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltF2&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventName char 3&gt&lteventName char 2&gt&lteventName char 1&gt&lteventName char 0&gt&lteventIndex&gt
    */
    encodeENRSP(nodeNumber, eventIdentifier, eventIndex) {
        // process eventIdentifier - remove spaces, limit to 8 chars, and pad with 0's if less than eight
        var processedEventIdentifier = eventIdentifier.trim().substring(0, 8).padStart(8, '0')
        return this.header({MinPri: 3}) + 'F2' + decToHex(nodeNumber, 4) + processedEventIdentifier + decToHex(eventIndex, 2) + ';';
    }


    // F3 ARON3
	// ARON3 Format: [<MjPri><MinPri=3><CANID>]<F3><NN hi><NN lo><EN hi><EN lo><data1><data2><data3>
    //
    decodeARON3(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ARON3',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'data1': parseInt(message.substr(17, 2), 16), 
                'data2': parseInt(message.substr(19, 2), 16), 
                'data3': parseInt(message.substr(21, 2), 16), 
                'text': "ARON3 (F3) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16) +
                    " data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode F3<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @param {int} data3 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltF3&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt&ltdata1&gt&ltdata2&gt&ltdata3&gt
    */
    encodeARON3(nodeNumber, eventNumber, data1, data2, data3) {
        return this.header({MinPri: 3}) + 'F3' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + decToHex(data3, 2) + ';';
    }


    // F4 AROF3
	// AROF3 Format: [<MjPri><MinPri=3><CANID>]<F4><NN hi><NN lo><EN hi><EN lo><data1><data2><data3>
    //
    decodeAROF3(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'AROF3',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'data1': parseInt(message.substr(17, 2), 16), 
                'data2': parseInt(message.substr(19, 2), 16), 
                'data3': parseInt(message.substr(21, 2), 16), 
                'text': "AROF3 (F4) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16) +
                    " data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode F4<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @param {int} data3 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltF4&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt&ltdata1&gt&ltdata2&gt&ltdata3&gt
    */
    encodeAROF3(nodeNumber, eventNumber, data1, data2, data3) {
        return this.header({MinPri: 3}) + 'F4' + decToHex(nodeNumber, 4) + decToHex(eventNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + decToHex(data3, 2) + ';';
    }


    // F5 EVLRNI
	// EVLRNI Format: [<MjPri><MinPri=3><CANID>]<F5><NN hi><NN lo><EN hi><EN lo>
    //                  <EN#><EV#><EV val>
    //
    decodeEVLRNI(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'EVLRNI',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'eventNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': message.substr(9, 8),
                'eventNumberIndex': parseInt(message.substr(17, 2), 16),
                'eventVariableIndex': parseInt(message.substr(19, 2), 16),
                'eventVariableValue': parseInt(message.substr(21, 2), 16),
                'text': "EVLRNI (F5) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) + 
					" Event Number Index " + parseInt(message.substr(17, 2), 16) + 
					" Event Variable Index " + parseInt(message.substr(19, 2), 16) + 
					" Event Variable Value " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode F5<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} eventNumber 0 to 65535
    * @param {int} eventNumberIndex 0 to 255
    * @param {int} eventVariableIndex 0 to 255
    * @param {int} eventVariableValue 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltF5&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventNumber hi&gt&lteventNumber lo&gt&lteventNumberIndex&gt&lteventVariableIndex&gt&ltdeventVariableValue&gt
    */
    encodeEVLRNI(nodeNumber, eventNumber, eventNumberIndex, eventVariableIndex, eventVariableValue) {
        return this.header({MinPri: 3}) + 'F5' + decToHex(nodeNumber, 4) + 
                        decToHex(eventNumber, 4) + 
                        decToHex(eventNumberIndex, 2) + 
                        decToHex(eventVariableIndex, 2) + 
                        decToHex(eventVariableValue, 2) + ';'
    }
    

    // F6 ACDAT
    // ACDAT Format: [<MjPri><MinPri=3><CANID>]<F6><NN hi><NNlo>
    //              <data1><data2><data3><data4><data5>   
    //
    decodeACDAT(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ACDAT',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'data1': parseInt(message.substr(13, 2), 16),
                'data2': parseInt(message.substr(15, 2), 16),
                'data3': parseInt(message.substr(17, 2), 16),
                'data4': parseInt(message.substr(19, 2), 16),
                'data5': parseInt(message.substr(21, 2), 16),
                'text': "ACDAT (F6) nodeNumber " + parseInt(message.substr(9, 4), 16) +
                                " data1 " + parseInt(message.substr(13, 2), 16) +
                                " data2 " + parseInt(message.substr(15, 2), 16) +
                                " data3 " + parseInt(message.substr(17, 2), 16) +
                                " data4 " + parseInt(message.substr(19, 2), 16) +
                                " data5 " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode F6<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @param {int} data3 0 to 255
    * @param {int} data4 0 to 255
    * @param {int} data5 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltF6&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdata1&gt&ltdata2&gt&ltdata3&gt&ltdata4&gt&ltdata5&gt
    */
    encodeACDAT(nodeNumber, data1, data2, data3, data4, data5) {
        return this.header({MinPri: 3}) + 'F6'  + decToHex(nodeNumber, 4) +
                                            decToHex(data1, 2) +
                                            decToHex(data2, 2) +
                                            decToHex(data3, 2) +
                                            decToHex(data4, 2) +
                                            decToHex(data5, 2) + ';'
    }
    

    // F7 ARDAT
    // ARDAT Format: [<MjPri><MinPri=3><CANID>]<F7><NN hi><NNlo>
    //              <data1><data2><data3><data4><data5>   
    //
    decodeARDAT(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ARDAT',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16),
                'data1': parseInt(message.substr(13, 2), 16),
                'data2': parseInt(message.substr(15, 2), 16),
                'data3': parseInt(message.substr(17, 2), 16),
                'data4': parseInt(message.substr(19, 2), 16),
                'data5': parseInt(message.substr(21, 2), 16),
                'text': "ARDAT (F7) nodeNumber " + parseInt(message.substr(9, 4), 16) +
                                " data1 " + parseInt(message.substr(13, 2), 16) +
                                " data2 " + parseInt(message.substr(15, 2), 16) +
                                " data3 " + parseInt(message.substr(17, 2), 16) +
                                " data4 " + parseInt(message.substr(19, 2), 16) +
                                " data5 " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode F7<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @param {int} data3 0 to 255
    * @param {int} data4 0 to 255
    * @param {int} data5 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltF7&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdata1&gt&ltdata2&gt&ltdata3&gt&ltdata4&gt&ltdata5&gt
    */
    encodeARDAT(nodeNumber, data1, data2, data3, data4, data5) {
        return this.header({MinPri: 3}) + 'F7'  + decToHex(nodeNumber, 4) +
                                            decToHex(data1, 2) +
                                            decToHex(data2, 2) +
                                            decToHex(data3, 2) +
                                            decToHex(data4, 2) +
                                            decToHex(data5, 2) + ';'
    }
    

    // F8 ASON3
	// ASON3 Format: [<MjPri><MinPri=3><CANID>]<F8><NN hi><NN lo><DN hi><DN lo><data1><data2><data3>
    //
    decodeASON3(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ASON3',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'data1': parseInt(message.substr(17, 2), 16), 
                'data2': parseInt(message.substr(19, 2), 16), 
                'data3': parseInt(message.substr(21, 2), 16),
                'text': "ASON3 (F8) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16) +
                    " data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode F8<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @param {int} data3 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltF8&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt&ltdata1&gt&ltdata2&gt&ltdata3&gt
    */
    encodeASON3(nodeNumber, deviceNumber, data1, data2, data3) {
        return this.header({MinPri: 3}) + 'F8' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + decToHex(data3, 2) + ';';
    }


    // F9 ASOF3
	// ASOF3 Format: [<MjPri><MinPri=3><CANID>]<F9><NN hi><NN lo><DN hi><DN lo><data1><data2><data3>
    //
    decodeASOF3(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ASOF3',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'data1': parseInt(message.substr(17, 2), 16), 
                'data2': parseInt(message.substr(19, 2), 16), 
                'data3': parseInt(message.substr(21, 2), 16),
                'text': "ASOF3 (F9) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16) +
                    " data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode F9<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @param {int} data3 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltF9&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt&ltdata1&gt&ltdata2&gt&ltdata3&gt
    */
    encodeASOF3(nodeNumber, deviceNumber, data1, data2, data3) {
        return this.header({MinPri: 3}) + 'F9' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + decToHex(data3, 2) + ';';
    }


    // FA DDES
    // DDES Format: [<MjPri><MinPri=3><CANID>]<FA><DN hi><DN lo>
    //              <data1><data2><data3><data4><data5>   
    //
    decodeDDES(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'DDES',
                'opCode': message.substr(7, 2),
                'deviceNumber': parseInt(message.substr(9, 4), 16),
                'data1': parseInt(message.substr(13, 2), 16),
                'data2': parseInt(message.substr(15, 2), 16),
                'data3': parseInt(message.substr(17, 2), 16),
                'data4': parseInt(message.substr(19, 2), 16),
                'data5': parseInt(message.substr(21, 2), 16),
                'text': "DDES (FA) deviceNumber " + parseInt(message.substr(9, 4), 16) +
                                " data1 " + parseInt(message.substr(13, 2), 16) +
                                " data2 " + parseInt(message.substr(15, 2), 16) +
                                " data3 " + parseInt(message.substr(17, 2), 16) +
                                " data4 " + parseInt(message.substr(19, 2), 16) +
                                " data5 " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode FA<br>
    * @param {int} deviceNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @param {int} data3 0 to 255
    * @param {int} data4 0 to 255
    * @param {int} data5 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltFA&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt&ltdata1&gt&ltdata2&gt&ltdata3&gt&ltdata4&gt&ltdata5&gt
    */
    encodeDDES(deviceNumber, data1, data2, data3, data4, data5) {
        return this.header({MinPri: 3}) + 'FA'  + decToHex(deviceNumber, 4) +
                                            decToHex(data1, 2) +
                                            decToHex(data2, 2) +
                                            decToHex(data3, 2) +
                                            decToHex(data4, 2) +
                                            decToHex(data5, 2) + ';'
    }
    

    // FB DDRS
    // DDRS Format: [<MjPri><MinPri=3><CANID>]<FB><DN hi><DN lo>
    //              <data1><data2><data3><data4><data5>   
    //
    decodeDDRS(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'DDRS',
                'opCode': message.substr(7, 2),
                'deviceNumber': parseInt(message.substr(9, 4), 16),
                'data1': parseInt(message.substr(13, 2), 16),
                'data2': parseInt(message.substr(15, 2), 16),
                'data3': parseInt(message.substr(17, 2), 16),
                'data4': parseInt(message.substr(19, 2), 16),
                'data5': parseInt(message.substr(21, 2), 16),
                'text': "DDRS (FB) deviceNumber " + parseInt(message.substr(9, 4), 16) +
                                " data1 " + parseInt(message.substr(13, 2), 16) +
                                " data2 " + parseInt(message.substr(15, 2), 16) +
                                " data3 " + parseInt(message.substr(17, 2), 16) +
                                " data4 " + parseInt(message.substr(19, 2), 16) +
                                " data5 " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode FB<br>
    * @param {int} deviceNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @param {int} data3 0 to 255
    * @param {int} data4 0 to 255
    * @param {int} data5 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltFB&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt&ltdata1&gt&ltdata2&gt&ltdata3&gt&ltdata4&gt&ltdata5&gt
    */
    encodeDDRS(deviceNumber, data1, data2, data3, data4, data5) {
        return this.header({MinPri: 3}) + 'FB'  + decToHex(deviceNumber, 4) +
                                            decToHex(data1, 2) +
                                            decToHex(data2, 2) +
                                            decToHex(data3, 2) +
                                            decToHex(data4, 2) +
                                            decToHex(data5, 2) + ';'
    }
    

    // FC DDWS
    // DDWS Format: [<MjPri><MinPri=3><CANID>]<FC><DN hi><DN lo>
    //              <data1><data2><data3><data4><data5>   
    //
    decodeDDWS(message) {
      return {'encoded': message,
        'ID_TYPE': 'S',
        'mnemonic': 'DDWS',
        'opCode': message.substr(7, 2),
        'deviceNumber': parseInt(message.substr(9, 4), 16),
        'data1': parseInt(message.substr(13, 2), 16),
        'data2': parseInt(message.substr(15, 2), 16),
        'data3': parseInt(message.substr(17, 2), 16),
        'data4': parseInt(message.substr(19, 2), 16),
        'data5': parseInt(message.substr(21, 2), 16),
        'text': "DDWS (FC) deviceNumber " + parseInt(message.substr(9, 4), 16) +
          " data1 " + parseInt(message.substr(13, 2), 16) +
          " data2 " + parseInt(message.substr(15, 2), 16) +
          " data3 " + parseInt(message.substr(17, 2), 16) +
          " data4 " + parseInt(message.substr(19, 2), 16) +
          " data5 " + parseInt(message.substr(21, 2), 16)
      }
    }
    /**
    * @desc opCode FC<br>
    * @param {int} deviceNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @param {int} data3 0 to 255
    * @param {int} data4 0 to 255
    * @param {int} data5 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltFC&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt&ltdata1&gt&ltdata2&gt&ltdata3&gt&ltdata4&gt&ltdata5&gt
    */
    encodeDDWS(deviceNumber, data1, data2, data3, data4, data5) {
      return this.header({MinPri: 3}) + 'FC'  + decToHex(deviceNumber, 4) +
        decToHex(data1, 2) +
        decToHex(data2, 2) +
        decToHex(data3, 2) +
        decToHex(data4, 2) +
        decToHex(data5, 2) + ';'
    }
    

    // FD ARSON3
    // ARSON3 Format: [<MjPri><MinPri=3><CANID>]<FD><NN hi><NN lo><DN hi><DN lo>
    //                  <data 1><data 2><data 3>
    //
    decodeARSON3(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ARSON3',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'data1': parseInt(message.substr(17, 2), 16), 
                'data2': parseInt(message.substr(19, 2), 16), 
                'data3': parseInt(message.substr(21, 2), 16), 
                'text': "ARSON3 (FD) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16) +
                    " data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode FD<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @param {int} data3 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltFD&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt&ltdata1&gt&ltdata2&gt&ltdata3&gt
    */
    encodeARSON3(nodeNumber, deviceNumber, data1, data2, data3) {
        return this.header({MinPri: 3}) + 'FD' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + decToHex(data3, 2) + ';';
    }


    // FE ARSOF3
	// ARSOF3 Format: [<MjPri><MinPri=3><CANID>]<FE><NN hi><NN lo><DN hi><DN lo>
    //                  <data 1><data 2><data 3>
    //
    decodeARSOF3(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'ARSOF3',
                'opCode': message.substr(7, 2),
                'nodeNumber': parseInt(message.substr(9, 4), 16), 
                'deviceNumber': parseInt(message.substr(13, 4), 16),
                'eventIdentifier': '0000' + message.substr(13, 4),
                'data1': parseInt(message.substr(17, 2), 16), 
                'data2': parseInt(message.substr(19, 2), 16), 
                'data3': parseInt(message.substr(21, 2), 16), 
                'text': "ARSOF3 (FE) Node " + parseInt(message.substr(9, 4), 16) + 
					" deviceNumber " + parseInt(message.substr(13, 4), 16) +
                    " data1 " + parseInt(message.substr(17, 2), 16) +
                    " data2 " + parseInt(message.substr(19, 2), 16) +
                    " data3 " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode FE<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {int} deviceNumber 0 to 65535
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @param {int} data3 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltFE&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&ltdeviceNumber hi&gt&ltdeviceNumber lo&gt&ltdata1&gt&ltdata2&gt&ltdata3&gt
    */
    encodeARSOF3(nodeNumber, deviceNumber, data1, data2, data3) {
        return this.header({MinPri: 3}) + 'FE' + decToHex(nodeNumber, 4) + decToHex(deviceNumber, 4) +
            decToHex(data1, 2) + decToHex(data2, 2) + decToHex(data3, 2) + ';';
    }


    // FF EXTC6
	// EXTC6 Format: [<MjPri><MinPri=3><CANID>]<DF><Ext_OPC><byte1><byte2><byte3><byte4><byte5><byte6>
    //
    decodeEXTC6(message) {
		return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'EXTC6',
                'opCode': message.substr(7, 2),
                'Ext_OPC': parseInt(message.substr(9, 2), 16), 
                'byte1': parseInt(message.substr(11, 2), 16),
                'byte2': parseInt(message.substr(13, 2), 16),
                'byte3': parseInt(message.substr(15, 2), 16),
                'byte4': parseInt(message.substr(17, 2), 16),
                'byte5': parseInt(message.substr(19, 2), 16),
                'byte6': parseInt(message.substr(21, 2), 16),
                'text': "EXTC6 (FF) Ext_OPC " + parseInt(message.substr(9, 2), 16) + 
					" byte1 " + parseInt(message.substr(11, 4), 16) +
					" byte2 " + parseInt(message.substr(13, 4), 16) +
					" byte3 " + parseInt(message.substr(15, 4), 16) +
					" byte4 " + parseInt(message.substr(17, 4), 16) +
					" byte5 " + parseInt(message.substr(19, 4), 16) +
					" byte6 " + parseInt(message.substr(21, 4), 16)
        }
    }
    /**
    * @desc opCode FF<br>
    * @param {int} Ext_OPC 0 to 255
    * @param {int} data1 0 to 255
    * @param {int} data2 0 to 255
    * @param {int} data3 0 to 255
    * @param {int} data4 0 to 255
    * @param {int} data5 0 to 255
    * @param {int} data6 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltFF&gt&ltExt_OPC&gt&ltdata1&gt&ltdata2&gt&ltdata3&gt&ltdata4&gt&ltdata5&gt&ltdata6&gt
    */
    encodeEXTC6(Ext_OPC, byte1, byte2, byte3, byte4, byte5, byte6) {
        return this.header({MinPri: 3}) + 'FF' + decToHex(Ext_OPC, 2) + 
                            decToHex(byte1, 2) + 
                            decToHex(byte2, 2) + 
                            decToHex(byte3, 2) + 
                            decToHex(byte4, 2) + 
                            decToHex(byte5, 2) + 
                            decToHex(byte6, 2) + ';';
    }


}

module.exports = new cbusLibrary();



