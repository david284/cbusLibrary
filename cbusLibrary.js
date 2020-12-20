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

function decToHex(num, len) {return parseInt(num).toString(16).toUpperCase().padStart(len, '0');}

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
                    'CAN_ID': 60,
        }
    }

    //
    // header() provides the prefix to add to CBUS data to compose a transmittable message
    // CAN uses a bitwise arbitration scheme whereby the header with the lowest value has priority
    // So higher values have lower priority
    // The CAN protocol prohibits a sequence of 7 or more 1 bits at the start of the header, so a
    // MjPri. of 11 in binary (3 in decimal) is not used
    //
    header({
                    MjPri = this.canHeader.MjPri,
                    MinPri = 3,
                    CAN_ID = this.canHeader.CAN_ID
        } = {}) {
        // ensure all variables don't exceed the appropriate number of bits for encoding
        if (MjPri > 2) {MjPri = 2}      // MjPri is two bits, but a value of 3 is not allowed
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
    *   'CAN_ID': 60,
    * }
    */
    getCanHeader() {
        return this.canHeader
        }
    /**
    * setCanHeader
    * @param {int} MjPri Major priority, two bit number 0 - 2, 3 not allowed
    * @param {int} CAN_ID 7 bit number, 0 to 127
    */
    setCanHeader(MjPri, CAN_ID) {
        if (MjPri != undefined) { 
        this.canHeader.MjPri = (MjPri > 2) ? 2 : MjPri}                     // MjPri is two bits, but a value of 3 is n0t allowed
        if (CAN_ID != undefined) { this.canHeader.CAN_ID = CAN_ID % 128}    // CAN_ID is 7 bits, 0 to 127
    }


    //
    //
    // Decode / Encode Methods strictly arranged by numerical opcode to ensure that it's easy to spot if a function already exists
    //
    //

    /**
    * @desc Decode a CAN message<br>
    * This will decode both 11 bit ID CBUS messages and also 29 bit extended messages, as these are identified in the message itself 
    * @param {String} message CAN BUS message in 'Grid connect' ASCII format
    * @return {String} Decoded properties as a JSON structure - content dependant on specific message, 
    * but always has 'encoded', 'ID_TYPE' & 'text' elements<br>
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
                    if (( message.substr(1, 1) == 'S' ) & (message.length >= 9)) {
                        return this.decodeStandardMessage(message)
                    } else if (( message.substr(1, 1) == 'X' ) & (message.length >= 11)) {
                        return this.decodeExtendedMessage(message)
                    } else {
                        return {'encoded': message,
                                'ID_TYPE': '',
                                'text': 'Unsupported message',
                        }
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
        // 12 - 20 reserved
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
        // 4D - 4F reserved
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
        // 5E reserved
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
        // 64 - 6E reserved
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
        // 76 - 7E reserved
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
        // 86 - 8F reserved
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
        // A3 - AF reserved
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
        // B7 - reserved
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
        // C2 - CE reserved
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
        // E4 - EE reserved
        case 'F0':
            return this.decodeACON3(message);
            break;
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
        // FC - reserved
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
            return {'encoded': message ,'mnemonic': 'UNSUPPORTED', 'opCode': message.substr(7, 2)}
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
                output['response'] = parseInt(message.substr(11, 2), 16)
                output['text'] = JSON.stringify(output)
        } else {
                output['Type'] = 'UNKNOWN MESSAGE'
                output['text'] = JSON.stringify(output)
        }
        return output
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
		return ":X00080000N" + address.substr(4, 2) + address.substr(2, 2) + address.substr(0, 2) + '00' + decToHex(CTLBT, 2) + decToHex(SPCMD, 2) + decToHex(CPDTL, 2) + decToHex(CPDTH, 2) + ";";
    }
    

    /**
    * @desc 29 bit Extended CAN Identifier 'Put Data' firmware download message<br>
    * @param {array} data 8 byte data array 
    * @return {string} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Example :X00080005N20EF04F0FFFFFFFF;<br>
    * 29 bit fixed header (:X00080004N.......)
    */
    encode_EXT_PUT_DATA(data) {
		return ":X00080001N" + 
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
    * 29 bit fixed header (:X80080000N.......)
    */
    encode_EXT_RESPONSE(response) {
		return ":X80080000N" + decToHex(response, 2) + ";";
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
	// RLOC Format: <MjPri><MinPri=2><CANID>]<41><ConID><Index>
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
    * @param {int} ConID number 0 to 255
    * @param {int} index number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt41&gt&ltConID&gt&ltindex&gt
    */
    encodeQCON(ConID, index) {
        return this.header({MinPri: 2}) + '41' + decToHex(ConID, 2) + decToHex(index, 2) + ';'
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
    encodeALOC(session, allocatonCode) {
            return this.header({MinPri: 2}) + '43' + decToHex(session, 2) + decToHex(allocatonCode, 2) + ';'
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
        var speedDir = speed + parseInt((direction == 'Reverse') ? 0 : 128)
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
    * @desc opCode 5C<br>
    * @param {int} Ext_OPC number 0 to 255
    * @param {int} byte1 number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&lt5C&gt&ltExt_OPC&gt&ltbyte1&gt
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
    // QCVS Format: [<MjPri><MinPri=2><CANID>]<84><Session><High CV#><Low CV#><Mode>
    //
    decodeQCVS(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'QCVS',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'CV': parseInt(message.substr(11, 4), 16),
                'Mode': parseInt(message.substr(15, 2), 16),
                'text': "QCVS (84) session " + parseInt(message.substr(9, 2), 16) + 
					" CV " + parseInt(message.substr(11, 2), 16) +
					" Mode " + parseInt(message.substr(15, 2), 16)
        }
    }
    /**
    * @desc opCode 83<br>
    * @param {int} session number 0 to 255
    * @param {int} CV number 0 to 65535
    * @param {int} Mode number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&lt83&gt&ltsession&gt&ltCV hi&gt&ltCV lo&gt&ltMode&gt
    */
    encodeQCVS(Session, CV, Mode) {
        return this.header({MinPri: 2}) + '84' + decToHex(Session, 2) + decToHex(CV, 4) + decToHex(Mode, 2) + ';'
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
                'eventName': message.substr(9, 8),
                'text': "EVULN (95) nodeNumber " + parseInt(message.substr(9, 4), 16) +
                    " eventNumber " + parseInt(message.substr(11, 4), 16) +
                    " eventName " + message.substr(9, 8)
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
    // WCVS Format: [<MjPri><MinPri=2><CANID>]<A2><Session><High CV#><LowCV#><Mode><CVval>
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
					" Mode " + parseInt(message.substr(15, 2), 16) +
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                hex:message.substr(17, 2)},
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                hex:message.substr(17, 2)},
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
                'eventName': message.substr(9, 8),               
                'eventVariableIndex': parseInt(message.substr(17, 2), 16),
                'text': "REQEV (B2) nodeNumber " + parseInt(message.substr(9, 4), 16) +
					" eventNumber " + parseInt(message.substr(13, 4), 16) +
					" eventName " + message.substr(9, 8) +
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                hex:message.substr(17, 2)},
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                hex:message.substr(17, 2)},
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16),
                                hex:message.substr(17, 2)},
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                hex:message.substr(17, 2)},
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16),
                                hex:message.substr(17, 2)},
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16),
                                hex:message.substr(17, 2)},
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
    // WCVOA Format: [<MjPri><MinPri=2><CANID>]<C1><AddrH><AddrL><High CV#><Low CV#><Mode><Val>
    //
    decodeWCVOA(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'WCVOA',
                'opCode': message.substr(7, 2),
                'session': parseInt(message.substr(9, 2), 16),
                'CV': parseInt(message.substr(11, 4), 16),
                'mode': parseInt(message.substr(15, 2), 16),
                'value': parseInt(message.substr(17, 2), 16),
                'text': "WCVOA (C1) session " + parseInt(message.substr(9, 2), 16) + 
					" CV " + parseInt(message.substr(11, 4), 16) +
					" mode " + parseInt(message.substr(15, 2), 16) +
					" value " + parseInt(message.substr(17, 2), 16)
        }
    }
    /**
    * @desc opCode C1<br>
    * @param {int} session number 0 to 255
    * @param {int} CV number 0 to 65535
    * @param {int} mode number 0 to 255
    * @param {int} value number 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=2&gt&ltCANID&gt]&ltC1&gt&ltsession&gt&ltCV hi&gt&ltCV lo&gt&ltmode&gt&ltvalue&gt
    */
    encodeWCVOA(Session, CV, mode, value) {
        return this.header({MinPri: 2}) + 'C1' + decToHex(Session, 2) + decToHex(CV, 4) + decToHex(mode, 2) + decToHex(value, 2) + ';'
    }
    

    // CF FCLK
    // FCLK Format: <MjPri><MinPri=3><CANID>]<CF><mins><hrs><wdmon><div><mday><temp>
    //
    decodeFCLK(message) {
        return {'encoded': message,
                'ID_TYPE': 'S',
                'mnemonic': 'FCLK',
                'opCode': message.substr(7, 2),
                'minutes': parseInt(message.substr(9, 2), 16),
                'hours': parseInt(message.substr(11, 2), 16),
                'wdmon': parseInt(message.substr(13, 2), 16),
                'div': parseInt(message.substr(15, 2), 16),
                'mday': parseInt(message.substr(17, 2), 16),
                'temp': parseInt(message.substr(19, 2), 16),
                'weekDay': parseInt(message.substr(13, 2), 16)%16,
                'month': parseInt(message.substr(13, 2), 16) >> 4,
                'text': "FCLK (CF) minutes " + parseInt(message.substr(9, 2), 16) + 
					" hours " + parseInt(message.substr(11, 4), 16) +
					" wdmon " + parseInt(message.substr(13, 2), 16) +
					" div " + parseInt(message.substr(15, 2), 16) +
					" mday " + parseInt(message.substr(17, 2), 16) +
					" temp " + parseInt(message.substr(19, 2), 16)
        }
    }
    /**
    * @desc opCode CF<br>
    * @param {int} minutes 0 to 59
    * @param {int} hours 0 to 23
    * @param {int} wdmon bits 0-3 are the weekday (1=Sun, 2=Mon etc), bits 4-7 are the month (1=Jan, 2=Feb etc)
    * @param {int} div Set to 0 for freeze, 1 for real time
    * @param {int} mday Day of the month 1-31
    * @param {int} temp Temperature as twos complement -127 to +127
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltCF&gt&ltmins&gt&lthrs&gt&ltwdmon&gt&ltdiv&gt&ltmday&gt&lttemp&gt
    */
    encodeFCLK(minutes, hours, wdmon, div, mday, temp) {
        return this.header({MinPri: 3}) + 'CF' + 
                            decToHex(minutes, 2) + 
                            decToHex(hours, 2) + 
                            decToHex(wdmon, 2) + 
                            decToHex(div, 2) + 
                            decToHex(mday, 2) + 
                            decToHex(temp, 2) + ';'
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                hex:message.substr(17, 4)},
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                hex:message.substr(17, 4)},
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
                'eventName': message.substr(9, 8),
                'eventVariableIndex': parseInt(message.substr(17, 2), 16),
                'eventVariableValue': parseInt(message.substr(19, 2), 16),
                'text': "EVLRN (D2) nodeNumber " + parseInt(message.substr(9, 4), 16) + 
                    " eventNumber " + parseInt(message.substr(13, 4), 16) + 
                    " eventName " + message.substr(9, 8) + 
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
                'eventName': message.substr(9, 8),
                'eventVariableIndex': parseInt(message.substr(17, 2), 16),
                'eventVariableValue': parseInt(message.substr(19, 2), 16),
                'text': "EVANS (D3) nodeNumber " + parseInt(message.substr(9, 4), 16) + 
                    " eventNumber " + parseInt(message.substr(13, 4), 16) + 
                    " eventName " + message.substr(9, 8) + 
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                hex:message.substr(17, 4)},
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                hex:message.substr(17, 4)},
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                hex:message.substr(17, 4)},
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                hex:message.substr(17, 4)},
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                hex:message.substr(17, 4)},
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                hex:message.substr(17, 4)},
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
        var speedDir = speed + parseInt((direction == 'Reverse') ? 0 : 128)
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                data3: parseInt(message.substr(21, 2), 16),
                                hex:message.substr(17, 6)},
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                data3: parseInt(message.substr(21, 2), 16),
                                hex:message.substr(17, 6)},
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
                'eventName': message.substr(13, 8),
                'eventIndex': parseInt(message.substr(21, 2), 16),
                'text': "ENRSP (F2) Node " + parseInt(message.substr(9, 4), 16) + 
					" EventName " + message.substr(13, 8) + 
					" Event Index " + parseInt(message.substr(21, 2), 16)
        }
    }
    /**
    * @desc opCode F2<br>
    * @param {int} nodeNumber 0 to 65535
    * @param {string} eventName 8 digit hexadecimal string, with leading zero's
    * @param {int} eventIndex 0 to 255
    * @return {String} CBUS message encoded as a 'Grid Connect' ASCII string<br>
    * Format: [&ltMjPri&gt&ltMinPri=3&gt&ltCANID&gt]&ltF2&gt&ltnodeNumber hi&gt&ltnodeNumber lo&gt&lteventName char 3&gt&lteventName char 2&gt&lteventName char 1&gt&lteventName char 0&gt&lteventIndex&gt
    */
    encodeENRSP(nodeNumber, eventName, eventIndex) {
        return this.header({MinPri: 3}) + 'F2' + decToHex(nodeNumber, 4) + eventName + decToHex(eventIndex, 2) + ';';
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                data3: parseInt(message.substr(21, 2), 16), 
                                hex:message.substr(17, 6)},
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                data3: parseInt(message.substr(21, 2), 16), 
                                hex:message.substr(17, 6)},
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
                'eventName': message.substr(9, 8),
                'eventNumberIndex': parseInt(message.substr(17, 2), 16),
                'eventVariableIndex': parseInt(message.substr(19, 2), 16),
                'eventVariableValue': parseInt(message.substr(21, 2), 16),
                'text': "EVLRNI (F5) Node " + parseInt(message.substr(9, 4), 16) + 
					" eventNumber " + parseInt(message.substr(13, 4), 16) + 
                    " eventName " + message.substr(9, 8) + 
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
        return this.header({MinPri: 2}) + 'F6'  + decToHex(nodeNumber, 4) +
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
        return this.header({MinPri: 2}) + 'F7'  + decToHex(nodeNumber, 4) +
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                data3: parseInt(message.substr(21, 2), 16),
                                hex:message.substr(17, 6)},
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                data3: parseInt(message.substr(21, 2), 16),
                                hex:message.substr(17, 6)},
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
        return this.header({MinPri: 2}) + 'FA'  + decToHex(deviceNumber, 4) +
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
        return this.header({MinPri: 2}) + 'FB'  + decToHex(deviceNumber, 4) +
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                data3: parseInt(message.substr(21, 2), 16), 
                                hex:message.substr(17, 6)},
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
                'eventData': {  data1: parseInt(message.substr(17, 2), 16), 
                                data2: parseInt(message.substr(19, 2), 16), 
                                data3: parseInt(message.substr(21, 2), 16), 
                                hex:message.substr(17, 6)},
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



