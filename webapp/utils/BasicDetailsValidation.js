sap.ui.define([], function () {
  "use strict";

  return {
    _getText: function (oResourceBundle, sKey, sDefaultText, aParams) {
      if (oResourceBundle && typeof oResourceBundle.getText === "function") {
        return oResourceBundle.getText(sKey, aParams);
      }
      return sDefaultText;
    },

    parseDob: function (sDob) {
      if (!sDob) return null;
      if (sDob instanceof Date) return isNaN(sDob.getTime()) ? null : sDob;
      if (typeof sDob !== "string") return null;

      var s = sDob.trim();
      if (!s) return null;

      // Handle ISO formats (YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD) or DD-MM-YYYY / DD.MM.YYYY
      var aParts = s.split(/[-/.]/);
      if (aParts.length === 3) {
        var p0 = parseInt(aParts[0], 10);
        var p1 = parseInt(aParts[1], 10);
        var p2 = parseInt(aParts[2], 10);

        // Case 1: YYYY-xx-xx (year is first)
        if (p0 >= 1900 && p0 <= 2100) {
          var y = p0, m, d;
          if (p1 > 12 && p2 <= 12) {
            // YYYY-DD-MM
            d = p1;
            m = p2;
          } else {
            // Standard ISO: YYYY-MM-DD
            m = p1;
            d = p2;
          }
          if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            var dObj = new Date(y, m - 1, d);
            if (dObj.getFullYear() === y && dObj.getMonth() === m - 1 && dObj.getDate() === d) {
              return dObj;
            }
          }
        }

        // Case 2: xx-xx-YYYY (year is last)
        if (p2 >= 1900 && p2 <= 2100) {
          var y2 = p2, m2, d2;
          if (p0 > 12 && p1 <= 12) {
            // DD-MM-YYYY
            d2 = p0;
            m2 = p1;
          } else if (p1 > 12 && p0 <= 12) {
            // MM-DD-YYYY
            m2 = p0;
            d2 = p1;
          } else {
            // Default DD-MM-YYYY
            d2 = p0;
            m2 = p1;
          }
          if (m2 >= 1 && m2 <= 12 && d2 >= 1 && d2 <= 31) {
            var dObj2 = new Date(y2, m2 - 1, d2);
            if (dObj2.getFullYear() === y2 && dObj2.getMonth() === m2 - 1 && dObj2.getDate() === d2) {
              return dObj2;
            }
          }
        }
      }

      var dNative = new Date(s);
      if (!isNaN(dNative.getTime())) {
        var ny = dNative.getFullYear();
        if (ny >= 1900 && ny <= 2100) {
          return dNative;
        }
      }

      return null;
    },

    calculateAge: function (dDob) {
      if (!dDob) return 0;
      var dToday = new Date();
      var age = dToday.getFullYear() - dDob.getFullYear();
      var m = dToday.getMonth() - dDob.getMonth();
      if (m < 0 || (m === 0 && dToday.getDate() < dDob.getDate())) {
        age--;
      }
      return age;
    },

    /**
     * Validates basic details step data for Create Customer Wizard.
     * @param {object} oData Basic details data object
     * @param {object} [oResourceBundle] i18n Resource bundle
     * @param {object} [oOptions] Extra options e.g. { bDpCompValid: true, bDpIndValid: true }
     * @returns {Array<object>} Array of validation message objects
     */
    validateBasicDetails: function (oData, oResourceBundle, oOptions) {
      oData = oData || {};
      oOptions = oOptions || {};
      var sEntityType = oData.entityType || "Company";
      var aMessages = [];

      var that = this;
      function flagError(sControlId, sTitleKey, sDefaultTitle, sMsgKey, sDefaultMsg) {
        var sTitle = that._getText(oResourceBundle, sTitleKey, sDefaultTitle);
        var sMsg = that._getText(oResourceBundle, sMsgKey, sDefaultMsg);
        aMessages.push({
          controlId: sControlId,
          type: "Error",
          title: sTitle,
          subtitle: sMsg,
          description: sMsg
        });
      }

      var sEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      var sNameRegex = /^[A-Za-zÀ-ÿ' -]{2,50}$/;

      if (sEntityType === "Company") {
        // Company Registered Name
        var sCompName = (oData.customerName || "").trim();
        if (!sCompName) {
          flagError("inputCompanyRegName", "lblCompanyRegName", "Company Registered Name", "valCompNameMandatory", "Company Registered Name is mandatory.");
        } else if (sCompName.length < 3 || sCompName.length > 100 || !/^[A-Za-z0-9&().,' -]{3,100}$/.test(sCompName)) {
          flagError("inputCompanyRegName", "lblCompanyRegName", "Company Registered Name", "valCompNameFormat", "Company Registered Name must be 3-100 characters (letters, numbers, spaces, &, ., ', -, () allowed).");
        }

        // Company Registration Number
        var sCompRegNo = (oData.companyRegNo || "").trim();
        if (!sCompRegNo) {
          flagError("inputCompanyRegNo", "lblCompanyRegNo", "Company Registration Number", "valCompRegNoMandatory", "Company Registration Number is mandatory.");
        } else if (sCompRegNo.length < 5 || sCompRegNo.length > 30 || !/^[A-Za-z0-9/-]{5,30}$/.test(sCompRegNo)) {
          flagError("inputCompanyRegNo", "lblCompanyRegNo", "Company Registration Number", "valCompRegNoFormat", "Company Registration Number must be 5-30 alphanumeric characters (or / and -).");
        }

        // VAT Number (Optional)
        var sVat = (oData.vatNumber || "").trim();
        if (sVat && !/^\d{8,15}$/.test(sVat)) {
          flagError("inputVatNumber", "lblVatNumber", "VAT Number", "valVatNumberFormat", "VAT Number must contain 8 to 15 digits.");
        }

        // Date of Birth
        var sDobComp = (oData.dateOfBirth || "").trim();
        var dDobC = this.parseDob(sDobComp);
        var bDpCompValid = oOptions.bDpCompValid !== undefined ? oOptions.bDpCompValid : true;

        if (!sDobComp) {
          flagError("dpCompanyDob", "lblDateOfBirth", "Date of Birth", "valDobMandatory", "Date of Birth is mandatory.");
        } else if (!dDobC && !bDpCompValid) {
          flagError("dpCompanyDob", "lblDateOfBirth", "Date of Birth", "valDobValid18Years", "Please enter a valid Date of Birth (yyyy-MM-dd) - must be at least 18 years old.");
        } else if (!dDobC) {
          flagError("dpCompanyDob", "lblDateOfBirth", "Date of Birth", "valDobValidFormat", "Please enter or select a valid Date of Birth (yyyy-MM-dd).");
        } else if (dDobC > new Date()) {
          flagError("dpCompanyDob", "lblDateOfBirth", "Date of Birth", "valDobFuture", "Date of Birth cannot be in the future.");
        } else if (this.calculateAge(dDobC) < 18) {
          flagError("dpCompanyDob", "lblDateOfBirth", "Date of Birth", "valAuthRep18Years", "Authorised Representative must be at least 18 years old.");
        }

        // Gender
        var sGenderComp = (oData.gender || "").trim();
        if (!sGenderComp) {
          flagError("selectCompanyGender", "lblGender", "Gender", "valGenderMandatory", "Gender selection is mandatory.");
        }

        // Mobile Number
        var sMobileComp = (oData.mobileNumber || "").trim();
        if (!sMobileComp) {
          flagError("inputCompanyMobile", "lblMobileNumber", "Mobile Number", "valMobileMandatory", "Mobile Number is mandatory.");
        } else if (!/^\d{10}$/.test(sMobileComp)) {
          flagError("inputCompanyMobile", "lblMobileNumber", "Mobile Number", "valMobileFormat", "Mobile Number must be exactly 10 digits (e.g., 0821234567).");
        }

        // Title
        var sTitleComp = (oData.title || "").trim();
        if (!sTitleComp) {
          flagError("selectCompanyTitle", "lblTitle", "Title", "valAuthRepTitleMandatory", "Authorised Representative Title is mandatory.");
        }

        // First Name
        var sFNComp = (oData.firstName || "").trim();
        if (!sFNComp) {
          flagError("inputCompanyFirstName", "lblFirstName", "First Name", "valAuthRepFirstNameMandatory", "Authorised Rep First Name is mandatory.");
        } else if (!sNameRegex.test(sFNComp)) {
          flagError("inputCompanyFirstName", "lblFirstName", "First Name", "valFirstNameFormat", "First Name must be 2-50 characters containing letters, spaces, ' or -.");
        }

        // Surname
        var sSNComp = (oData.surname || "").trim();
        if (!sSNComp) {
          flagError("inputCompanySurname", "lblSurname", "Surname", "valAuthRepSurnameMandatory", "Authorised Rep Surname is mandatory.");
        } else if (!sNameRegex.test(sSNComp)) {
          flagError("inputCompanySurname", "lblSurname", "Surname", "valSurnameFormat", "Surname must be 2-50 characters containing letters, spaces, ' or -.");
        }

        // ID Type
        var sIdTypeComp = (oData.idType || "").trim();
        if (!sIdTypeComp) {
          flagError("selectCompanyIdType", "lblIdType", "ID Type", "valIdTypeMandatory", "ID Type selection is mandatory.");
        }

        // ID Number
        var sIdNoComp = (oData.idNumber || "").trim();
        if (!sIdNoComp) {
          flagError("inputCompanyIdNo", "lblIdNumber", "ID Number", "valIdNumberMandatory", "ID Number is mandatory.");
        } else if (sIdTypeComp === "SA ID Number" && !/^\d{13}$/.test(sIdNoComp)) {
          flagError("inputCompanyIdNo", "lblIdNumber", "ID Number", "valSaIdFormat", "SA ID Number must be exactly 13 digits.");
        } else if (sIdTypeComp === "Passport" && !/^[A-Za-z0-9]{6,12}$/.test(sIdNoComp)) {
          flagError("inputCompanyIdNo", "lblIdNumber", "ID Number", "valPassportFormat", "Passport number must be 6 to 12 alphanumeric characters.");
        } else if (sIdTypeComp !== "SA ID Number" && sIdTypeComp !== "Passport" && !/^[A-Za-z0-9-]{5,20}$/.test(sIdNoComp)) {
          flagError("inputCompanyIdNo", "lblIdNumber", "ID Number", "valIdNumberFormat", "ID Number must be 5 to 20 characters.");
        }

        // Email Address
        var sEmailComp = (oData.emailAddress || "").trim();
        if (!sEmailComp) {
          flagError("inputCompanyEmail", "lblEmailAddress", "Email Address", "valEmailMandatory", "Email Address is mandatory.");
        } else if (!sEmailRegex.test(sEmailComp) || sEmailComp.length < 5 || sEmailComp.length > 100) {
          flagError("inputCompanyEmail", "lblEmailAddress", "Email Address", "valEmailFormat", "Please enter a valid Email Address (e.g., user@domain.com).");
        }

      } else {
        // Individual Entity Type
        // Title
        var sTitleInd = (oData.title || "").trim();
        if (!sTitleInd) {
          flagError("selectIndivTitle", "lblTitle", "Title", "valTitleMandatory", "Title selection is mandatory.");
        }

        // First Name
        var sFNInd = (oData.firstName || "").trim();
        if (!sFNInd) {
          flagError("inputIndivFirstName", "lblFirstName", "First Name", "valFirstNameMandatory", "First Name is mandatory.");
        } else if (!sNameRegex.test(sFNInd)) {
          flagError("inputIndivFirstName", "lblFirstName", "First Name", "valFirstNameFormat", "First Name must be 2-50 characters containing letters, spaces, ' or -.");
        }

        // Surname
        var sSNInd = (oData.surname || "").trim();
        if (!sSNInd) {
          flagError("inputIndivSurname", "lblSurname", "Surname", "valSurnameMandatory", "Surname is mandatory.");
        } else if (!sNameRegex.test(sSNInd)) {
          flagError("inputIndivSurname", "lblSurname", "Surname", "valSurnameFormat", "Surname must be 2-50 characters containing letters, spaces, ' or -.");
        }

        // Date of Birth
        var sDobInd = (oData.dateOfBirth || "").trim();
        var dDobI = this.parseDob(sDobInd);
        var bDpIndValid = oOptions.bDpIndValid !== undefined ? oOptions.bDpIndValid : true;

        if (!sDobInd) {
          flagError("dpIndivDob", "lblDateOfBirth", "Date of Birth", "valDobMandatory", "Date of Birth is mandatory.");
        } else if (!dDobI && !bDpIndValid) {
          flagError("dpIndivDob", "lblDateOfBirth", "Date of Birth", "valDobValid18Years", "Please enter a valid Date of Birth (yyyy-MM-dd) - must be at least 18 years old.");
        } else if (!dDobI) {
          flagError("dpIndivDob", "lblDateOfBirth", "Date of Birth", "valDobValidFormat", "Please enter or select a valid Date of Birth (yyyy-MM-dd).");
        } else if (dDobI > new Date()) {
          flagError("dpIndivDob", "lblDateOfBirth", "Date of Birth", "valDobFuture", "Date of Birth cannot be in the future.");
        } else if (this.calculateAge(dDobI) < 18) {
          flagError("dpIndivDob", "lblDateOfBirth", "Date of Birth", "valCust18Years", "Customer must be at least 18 years old.");
        }

        // Gender
        var sGenderInd = (oData.gender || "").trim();
        if (!sGenderInd) {
          flagError("selectIndivGender", "lblGender", "Gender", "valGenderMandatory", "Gender selection is mandatory.");
        }

        // ID Type
        var sIdTypeInd = (oData.idType || "").trim();
        if (!sIdTypeInd) {
          flagError("selectIndivIdType", "lblIdType", "ID Type", "valIdTypeMandatory", "ID Type selection is mandatory.");
        }

        // ID Number
        var sIdNoInd = (oData.idNumber || "").trim();
        if (!sIdNoInd) {
          flagError("inputIndivIdNo", "lblIdNumber", "ID Number", "valIdNumberMandatory", "ID Number is mandatory.");
        } else if (sIdTypeInd === "SA ID Number" && !/^\d{13}$/.test(sIdNoInd)) {
          flagError("inputIndivIdNo", "lblIdNumber", "ID Number", "valSaIdFormat", "SA ID Number must be exactly 13 digits.");
        } else if (sIdTypeInd === "Passport" && !/^[A-Za-z0-9]{6,12}$/.test(sIdNoInd)) {
          flagError("inputIndivIdNo", "lblIdNumber", "ID Number", "valPassportFormat", "Passport number must be 6 to 12 alphanumeric characters.");
        } else if (sIdTypeInd !== "SA ID Number" && sIdTypeInd !== "Passport" && !/^[A-Za-z0-9-]{5,20}$/.test(sIdNoInd)) {
          flagError("inputIndivIdNo", "lblIdNumber", "ID Number", "valIdNumberFormat", "ID Number must be 5 to 20 characters.");
        }

        // Mobile Number
        var sMobileInd = (oData.mobileNumber || "").trim();
        if (!sMobileInd) {
          flagError("inputIndivMobile", "lblMobileNumber", "Mobile Number", "valMobileMandatory", "Mobile Number is mandatory.");
        } else if (!/^\d{10}$/.test(sMobileInd)) {
          flagError("inputIndivMobile", "lblMobileNumber", "Mobile Number", "valMobileFormat", "Mobile Number must be exactly 10 digits (e.g., 0821234567).");
        }

        // Email Address
        var sEmailInd = (oData.emailAddress || "").trim();
        if (!sEmailInd) {
          flagError("inputIndivEmail", "lblEmailAddress", "Email Address", "valEmailMandatory", "Email Address is mandatory.");
        } else if (!sEmailRegex.test(sEmailInd) || sEmailInd.length < 5 || sEmailInd.length > 100) {
          flagError("inputIndivEmail", "lblEmailAddress", "Email Address", "valEmailFormat", "Please enter a valid Email Address (e.g., user@domain.com).");
        }
      }

      return aMessages;
    }
  };
});
