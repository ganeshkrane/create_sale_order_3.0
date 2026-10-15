sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/Fragment",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/m/MessagePopover",
  "sap/m/MessageItem",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/salesorder/store/model/models",
  "sap/m/StepInput",
  "sap/ui/salesorder/store/utils/BasicDetailsValidation"
], function (BaseController, JSONModel, Fragment, MessageToast, MessageBox, MessagePopover, MessageItem, Filter, FilterOperator, models, StepInput, BasicDetailsValidation) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.CustomerWizard", {
    onInit: function () {
      var oWizardModel = new JSONModel({
        searchPanelExpanded: true,
        showNewCustomerCapture: false,
        isCreatingNewCustomer: false,
        customerSelected: false,
        addressValidated: false,
        isNewlyCreatedCustomer: false,
        newCustomerTypeIndex: 0,
        searchCriteria: {
          customerName: "",
          mobile: "",
          email: ""
        },
        productSearchQuery: "",
        selectedCategory: "All",
        orderCreated: false
      });
      this.getView().setModel(oWizardModel, "wizardModel");

      // Ensure Step 1 is unvalidated until customer is selected or created
      var oStepCustomer = this.byId("stepCustomer");
      if (oStepCustomer) {
        oStepCustomer.setValidated(false);
      }

      // Ensure Step 2 is unvalidated until 1st dropdown value is selected
      var oStepConsent = this.byId("stepConsent");
      if (oStepConsent) {
        var sMarketToYou = this.getModel("appState").getProperty("/marketing/marketToYou");
        oStepConsent.setValidated(!!sMarketToYou);
      }

      // Ensure pricing is initialized
      this.recalculateTotals();
      this._updatePendingActionText();

      // Setup DatePicker limits (must be at least 18 years old)
      this._setupDatePickerLimits();

      // Initialize messages model for MessagePopover
      var oMessageModel = new JSONModel([]);
      this.getView().setModel(oMessageModel, "messages");

      var that = this;
      this._oMessagePopover = new MessagePopover({
        activeTitlePress: function (oEvt) {
          var oItem = oEvt.getParameter("item");
          var oBindingContext = oItem.getBindingContext("messages");
          if (oBindingContext) {
            var sControlId = oBindingContext.getProperty("controlId");
            if (sControlId) {
              var oCtrl = that.byId(sControlId);
              if (oCtrl && oCtrl.focus) {
                oCtrl.focus();
              }
            }
          }
        },
        items: {
          path: "messages>/",
          template: new MessageItem({
            type: "{messages>type}",
            title: "{messages>title}",
            description: "{messages>description}",
            subtitle: "{messages>subtitle}"
          })
        }
      });
      this.getView().addDependent(this._oMessagePopover);
    },

    _setupDatePickerLimits: function () {
      var dToday = new Date();
      var dMaxDate = new Date(dToday.getFullYear() - 18, dToday.getMonth(), dToday.getDate());

      var oDpComp = this.byId("dpCompanyDob");
      if (oDpComp && oDpComp.setMaxDate) {
        oDpComp.setMaxDate(dMaxDate);
      }
      var oDpInd = this.byId("dpIndivDob");
      if (oDpInd && oDpInd.setMaxDate) {
        oDpInd.setMaxDate(dMaxDate);
      }
    },

    // ========================================================
    // STEP 1: CUSTOMER LOOKUP & CAPTURE
    // ========================================================
    onSearchCustomerClick: function () {
      var oWizardModel = this.getView().getModel("wizardModel");
      var oCriteria = oWizardModel.getProperty("/searchCriteria") || {};
      var sName = (oCriteria.customerName || "").trim();
      var sMobile = (oCriteria.mobile || "").trim();
      var sEmail = (oCriteria.email || "").trim();

      // No validation required: if no criteria provided, display all customer records
      this.getModel("appState").setProperty("/searchFilterValue", sName);
      this._openSearchResultsDialog(sName, sMobile, sEmail);
    },

    _openSearchResultsDialog: function (sName, sMobile, sEmail) {
      var oView = this.getView();
      var that = this;

      if (!this._pResultsDialog) {
        this._pResultsDialog = Fragment.load({
          id: oView.getId(),
          name: "sap.ui.salesorder.store.view.fragments.CustomerSearchResultsDialog",
          controller: this
        }).then(function (oDialog) {
          oView.addDependent(oDialog);
          return oDialog;
        });
      }

      this._pResultsDialog.then(function (oDialog) {
        var oTable = Fragment.byId(oView.getId(), "customerResultsTable");
        var oBinding = oTable.getBinding("items");
        var aFilters = [];

        if (sName) {
          aFilters.push(new Filter("name", FilterOperator.Contains, sName));
        }
        if (sMobile) {
          aFilters.push(new Filter("telephone", FilterOperator.Contains, sMobile));
        }
        if (sEmail) {
          aFilters.push(new Filter("email", FilterOperator.Contains, sEmail));
        }

        if (aFilters.length > 0) {
          oBinding.filter(new Filter({ filters: aFilters, and: false }));
        } else {
          // If no search criteria provided, display all data
          oBinding.filter([]);
        }

        var aItems = oTable.getItems();
        if (aItems.length > 0) {
          oTable.setSelectedItem(aItems[0]);
          that._selectedCustomerContext = aItems[0].getBindingContext("customers");
        } else {
          that._selectedCustomerContext = null;
        }
        oDialog.open();
      });
    },

    onSelectCustomerRow: function (oEvent) {
      var oListItem = oEvent.getParameter("listItem");
      this._selectedCustomerContext = oListItem.getBindingContext("customers");
    },

    onLiveSearchDialog: function (oEvent) {
      var sValue = oEvent.getParameter("value");
      var oTable = Fragment.byId(this.getView().getId(), "customerResultsTable");
      var oBinding = oTable.getBinding("items");

      if (sValue) {
        var aFilters = [
          new Filter("name", FilterOperator.Contains, sValue),
          new Filter("bpNumber", FilterOperator.Contains, sValue),
          new Filter("telephone", FilterOperator.Contains, sValue),
          new Filter("email", FilterOperator.Contains, sValue)
        ];
        oBinding.filter(new Filter({ filters: aFilters, and: false }));
      } else {
        oBinding.filter([]);
      }
    },

    onConfirmCustomerSelection: function () {
      if (!this._selectedCustomerContext) {
        var oTable = Fragment.byId(this.getView().getId(), "customerResultsTable");
        var aItems = oTable.getItems();
        if (aItems.length > 0) {
          this._selectedCustomerContext = aItems[0].getBindingContext("customers");
        }
      }

      if (this._selectedCustomerContext) {
        var oCustomerData = this._selectedCustomerContext.getObject();
        var oAppState = this.getModel("appState");
        oAppState.setProperty("/customer", JSON.parse(JSON.stringify(oCustomerData)));
        oAppState.setProperty("/orderHeader/soldToParty", oCustomerData.bpNumber + " - " + oCustomerData.name);
        oAppState.setProperty("/orderHeader/shipToParty", oCustomerData.bpNumber + " - " + oCustomerData.name);
        oAppState.setProperty("/delivery/address", oCustomerData.address);
        MessageToast.show("Customer " + oCustomerData.name + " (BP " + oCustomerData.bpNumber + ") selected");
      }

      this.onCloseSearchResultsDialog();
      var oWizardModel = this.getView().getModel("wizardModel");
      oWizardModel.setProperty("/showNewCustomerCapture", false);
      oWizardModel.setProperty("/isCreatingNewCustomer", false);
      oWizardModel.setProperty("/isNewlyCreatedCustomer", false);
      oWizardModel.setProperty("/customerSelected", true);
      oWizardModel.setProperty("/addressValidated", true);
      oWizardModel.setProperty("/searchPanelExpanded", false);

      var oStepCustomer = this.byId("stepCustomer");
      if (oStepCustomer) {
        oStepCustomer.setValidated(true);
      }
      var oWizard = this.byId("salesOrderWizard");
      if (oWizard && oStepCustomer) {
        oWizard.validateStep(oStepCustomer);
      }
    },

    onCustomerNotFound: function () {
      this.onCloseSearchResultsDialog();
      this.onShowCustomerNotFoundCapture();
    },

    onCloseSearchResultsDialog: function () {
      if (this._pResultsDialog) {
        this._pResultsDialog.then(function (oDialog) {
          oDialog.close();
        });
      }
    },

    onClearSearchCriteria: function () {
      this.getView().getModel("wizardModel").setProperty("/searchCriteria", {
        customerName: "",
        mobile: "",
        email: ""
      });
    },

    onShowCustomerNotFoundCapture: function () {
      var oWizardModel = this.getView().getModel("wizardModel");
      oWizardModel.setProperty("/isCreatingNewCustomer", true);
      oWizardModel.setProperty("/customerSelected", false);
      oWizardModel.setProperty("/addressValidated", false);
      oWizardModel.setProperty("/isNewlyCreatedCustomer", false);
      oWizardModel.setProperty("/showNewCustomerCapture", false);

      var oAppState = this.getModel("appState");
      var oCriteria = oWizardModel.getProperty("/searchCriteria") || {};
      var sCriteriaName = (oCriteria.customerName || "").trim();
      var aNames = sCriteriaName.split(" ");
      var sFirst = aNames[0] || "";
      var sLast = aNames.slice(1).join(" ") || "";

      var oDraft = {
        bpNumber: "",
        name: sCriteriaName || "",
        firstName: sFirst,
        lastName: sLast,
        title: "Mr.",
        telephone: oCriteria.mobile || "",
        email: oCriteria.email || "",
        type: "Individual",
        dateOfBirth: "",
        gender: "Male",
        idType: "SA ID Number",
        idPassport: oCriteria.idNumber || "",
        companyName: sCriteriaName || "",
        regNo: "",
        vatNo: "",
        authRepTitle: "Mr.",
        authRepFirstName: sFirst,
        authRepSurname: sLast,
        contactPerson: sCriteriaName || "",
        language: "English",
        salesOrg: "1000",
        distChannel: "10",
        division: "00",
        address: {
          street: "",
          city: "",
          postalCode: "",
          region: "",
          country: "ZA",
          formatted: "",
          type: "Default / Billing",
          status: "",
          statusState: "None"
        }
      };

      oAppState.setProperty("/customer", oDraft);

      var oStepCustomer = this.byId("stepCustomer");
      if (oStepCustomer) {
        oStepCustomer.setValidated(false);
      }
      MessageToast.show("Please enter Customer Basic Details and validate Address");
    },

    onCancelNewCustomer: function () {
      var oWizardModel = this.getView().getModel("wizardModel");
      oWizardModel.setProperty("/showNewCustomerCapture", false);
      oWizardModel.setProperty("/isCreatingNewCustomer", false);
      oWizardModel.setProperty("/customerSelected", false);
      oWizardModel.setProperty("/addressValidated", false);
      oWizardModel.setProperty("/isNewlyCreatedCustomer", false);

      var oStepCustomer = this.byId("stepCustomer");
      if (oStepCustomer) {
        oStepCustomer.setValidated(false);
      }
      MessageToast.show("Cancelled new customer creation");
    },

    onSelectEntityTypeIndividual: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/customer/type", "Individual");
      this._clearAllBasicDetailsControlStates();
      this.onUpdateCustomerName();
    },

    onSelectEntityTypeCompany: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/customer/type", "Company");
      this._clearAllBasicDetailsControlStates();
      this.onUpdateCustomerName();
    },

    onNameLiveChange: function (oEvent) {
      var oSource = oEvent.getSource();
      var sVal = oEvent.getParameter("value") || "";
      var sClean = sVal.replace(/[^a-zA-Z\s.'-]/g, "");
      if (sVal !== sClean) {
        oSource.setValue(sClean);
      }
      var oBinding = oSource.getBinding("value");
      if (oBinding) {
        oBinding.setValue(sClean);
      }
      this.onUpdateCustomerName();
      if (oSource.getValueState && oSource.getValueState() === "Error") {
        this._validateBasicDetailsForm(true);
      }
    },

    onMobileLiveChange: function (oEvent) {
      var oSource = oEvent.getSource();
      var sVal = oEvent.getParameter("value") || "";
      var sClean = sVal.replace(/[^\d]/g, "").slice(0, 10);
      if (sVal !== sClean) {
        oSource.setValue(sClean);
      }
      var oBinding = oSource.getBinding("value");
      if (oBinding) {
        oBinding.setValue(sClean);
      }
      if (oSource.getValueState && oSource.getValueState() === "Error") {
        this._validateBasicDetailsForm(true);
      }
    },

    onIdNoLiveChange: function (oEvent) {
      var oSource = oEvent.getSource();
      var sVal = oEvent.getParameter("value") || "";
      var oAppState = this.getModel("appState");
      var sIdType = oAppState ? (oAppState.getProperty("/customer/idType") || "SA ID Number") : "SA ID Number";

      var sClean = sVal;
      if (sIdType === "SA ID Number") {
        sClean = sVal.replace(/[^\d]/g, "").slice(0, 13);
      } else if (sIdType === "Passport") {
        sClean = sVal.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12);
      } else {
        sClean = sVal.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 20);
      }

      if (sVal !== sClean) {
        oSource.setValue(sClean);
      }
      var oBinding = oSource.getBinding("value");
      if (oBinding) {
        oBinding.setValue(sClean);
      }
      if (oSource.getValueState && oSource.getValueState() === "Error") {
        this._validateBasicDetailsForm(true);
      }
    },

    onDobChange: function (oEvent) {
      var oDP = oEvent.getSource();
      var sVal = oEvent.getParameter("value") || oDP.getValue() || "";
      var oAppState = this.getModel("appState");
      if (oAppState) {
        oAppState.setProperty("/customer/dateOfBirth", sVal);
      }
      if (oDP.getValueState && oDP.getValueState() === "Error") {
        this._validateBasicDetailsForm(true);
      }
    },

    onFieldChange: function (oEvent) {
      if (oEvent && oEvent.getSource) {
        var oSource = oEvent.getSource();
        var oBinding = oSource.getBinding && (oSource.getBinding("value") || oSource.getBinding("selectedKey"));
        if (oBinding && oSource.getValue) {
          oBinding.setValue(oSource.getValue());
        }
        if (oSource.getValueState && oSource.getValueState() === "Error") {
          this._validateBasicDetailsForm(true);
        }
      }
    },

    _clearAllBasicDetailsControlStates: function () {
      var aControlIds = [
        "inputCompanyRegName", "inputCompanyRegNo", "inputVatNumber", "dpCompanyDob", "selectCompanyGender",
        "inputCompanyMobile", "selectCompanyTitle", "inputCompanyFirstName", "inputCompanySurname",
        "selectCompanyIdType", "inputCompanyIdNo", "inputCompanyEmail",
        "selectIndivTitle", "inputIndivFirstName", "inputIndivSurname", "dpIndivDob",
        "selectIndivGender", "selectIndivIdType", "inputIndivIdNo", "inputIndivMobile", "inputIndivEmail"
      ];
      var that = this;
      aControlIds.forEach(function (sId) {
        var oCtrl = that.byId(sId);
        if (oCtrl && oCtrl.setValueState) {
          oCtrl.setValueState("None");
          oCtrl.setValueStateText("");
        }
      });
    },

    _validateBasicDetailsForm: function (bSilent) {
      var oAppState = this.getModel("appState");
      var oCustomer = oAppState ? oAppState.getProperty("/customer") : {};
      oCustomer = oCustomer || {};
      var sEntityType = oCustomer.type || "Individual";

      this._clearAllBasicDetailsControlStates();
      this._setupDatePickerLimits();

      var oDpComp = this.byId("dpCompanyDob");
      var oDpInd = this.byId("dpIndivDob");

      var oValidationData = {
        entityType: sEntityType,
        customerName: (sEntityType === "Company" ? oCustomer.companyName : ((oCustomer.firstName || "") + " " + (oCustomer.lastName || ""))) || "",
        companyRegNo: oCustomer.regNo || "",
        vatNumber: oCustomer.vatNo || "",
        dateOfBirth: oCustomer.dateOfBirth || "",
        gender: oCustomer.gender || "",
        mobileNumber: oCustomer.telephone || "",
        emailAddress: oCustomer.email || "",
        title: sEntityType === "Company" ? (oCustomer.authRepTitle || "") : (oCustomer.title || ""),
        firstName: sEntityType === "Company" ? (oCustomer.authRepFirstName || "") : (oCustomer.firstName || ""),
        surname: sEntityType === "Company" ? (oCustomer.authRepSurname || "") : (oCustomer.lastName || ""),
        idType: oCustomer.idType || "SA ID Number",
        idNumber: oCustomer.idPassport || ""
      };

      var aValidationErrors = BasicDetailsValidation.validateBasicDetails(
        oValidationData,
        this.getResourceBundle(),
        {
          bDpCompValid: (sEntityType === "Company" && oDpComp && oDpComp.isValidValue) ? oDpComp.isValidValue() : ((sEntityType === "Individual" && oDpInd && oDpInd.isValidValue) ? oDpInd.isValidValue() : true)
        }
      );

      if (aValidationErrors && aValidationErrors.length > 0) {
        var that = this;
        var oFirstCtrlToFocus = null;

        aValidationErrors.forEach(function (oErr) {
          if (oErr.controlId) {
            var oCtrl = that.byId(oErr.controlId);
            if (oCtrl && oCtrl.setValueState) {
              oCtrl.setValueState("Error");
              oCtrl.setValueStateText(oErr.subtitle || oErr.description);
              if (!oFirstCtrlToFocus && oCtrl.focus) {
                oFirstCtrlToFocus = oCtrl;
              }
            }
          }
        });

        if (!bSilent) {
          var sFirstErrorMsg = aValidationErrors[0].subtitle || aValidationErrors[0].description;
          MessageBox.error(sFirstErrorMsg, {
            title: "Validation Error",
            onClose: function () {
              if (oFirstCtrlToFocus && oFirstCtrlToFocus.focus) {
                oFirstCtrlToFocus.focus();
              }
            }
          });
        }
        return false;
      }

      return true;
    },

    onUpdateCustomerName: function () {
      var oAppState = this.getModel("appState");
      var sType = oAppState.getProperty("/customer/type") || "Individual";
      var sBp = oAppState.getProperty("/customer/bpNumber") || ("10002" + Math.floor(10000 + Math.random() * 90000));
      if (!oAppState.getProperty("/customer/bpNumber")) {
        oAppState.setProperty("/customer/bpNumber", sBp);
      }

      var sName = "";
      if (sType === "Company") {
        sName = oAppState.getProperty("/customer/companyName") || "Company";
      } else {
        var sFirst = oAppState.getProperty("/customer/firstName") || "";
        var sLast = oAppState.getProperty("/customer/lastName") || "";
        sName = (sFirst + " " + sLast).trim() || "New Customer";
      }

      oAppState.setProperty("/customer/name", sName);
      oAppState.setProperty("/orderHeader/soldToParty", sBp + " - " + sName);
      oAppState.setProperty("/orderHeader/shipToParty", sBp + " - " + sName);
    },

    onNewCustomerTypeChange: function (oEvent) {
      var nIndex = oEvent.getParameter("selectedIndex");
      this.getView().getModel("wizardModel").setProperty("/newCustomerTypeIndex", nIndex);
      if (nIndex === 1) {
        this.onSelectEntityTypeCompany();
      } else {
        this.onSelectEntityTypeIndividual();
      }
    },

    onCreateShellBpConfirm: function () {
      this.onUpdateCustomerName();
      var oWizardModel = this.getView().getModel("wizardModel");
      oWizardModel.setProperty("/showNewCustomerCapture", false);
      oWizardModel.setProperty("/isCreatingNewCustomer", true);
      this._setupDatePickerLimits();
      this._clearAllBasicDetailsControlStates();
      MessageToast.show("Basic Details ready for customer creation");
    },

    onUpdateFullName: function () {
      this.onUpdateCustomerName();
    },

    onUpdateCompanyName: function () {
      this.onUpdateCustomerName();
    },

    // ========================================================
    // STEP 2: ADDRESS VALIDATION
    // ========================================================
    onOpenAddressPluginModal: function () {
      // 1. Validate basic details of individual or company first based on radio button selection
      var bValid = this._validateBasicDetailsForm(false);
      if (!bValid) {
        return; // Validation failed: errors highlighted, popup NOT opened
      }

      // 2. If all ok, open the address plugin popup!
      var that = this;
      var oAppState = this.getModel("appState");

      this.openAddressValidationDialog("Default (Billing)", function (oSelectedAddress) {
        if (oSelectedAddress) {
          var oAddrObj = {
            street: oSelectedAddress.street || "",
            city: oSelectedAddress.city || "",
            postalCode: oSelectedAddress.postalCode || "",
            region: oSelectedAddress.region || "",
            formatted: oSelectedAddress.formatted || "",
            type: "Default / Billing",
            status: oSelectedAddress.status || "EXISTING",
            statusState: that.formatter.addressStatusState(oSelectedAddress.status)
          };
          oAppState.setProperty("/customer/address", oAddrObj);
          oAppState.setProperty("/delivery/address", oAddrObj);
          that.getView().getModel("wizardModel").setProperty("/addressValidated", true);
          that._updatePendingActionText();
          MessageToast.show("Address validated: " + (oAddrObj.formatted || oAddrObj.status));
        }
      });
    },

    onSelectSuggestedAddress: function (oEvent) {
      var oItem = oEvent.getParameter("listItem");
      var oSelectedAddress = oItem.getBindingContext("addresses").getObject();
      var oAppState = this.getModel("appState");
      var that = this;

      var oAddrObj = {
        street: oSelectedAddress.street || "",
        city: oSelectedAddress.city || "",
        postalCode: oSelectedAddress.postalCode || "",
        region: oSelectedAddress.region || "",
        formatted: oSelectedAddress.formatted || "",
        type: "Default / Billing",
        status: oSelectedAddress.status || "EXISTING",
        statusState: that.formatter.addressStatusState(oSelectedAddress.status)
      };
      oAppState.setProperty("/customer/address", oAddrObj);
      oAppState.setProperty("/delivery/address", oAddrObj);
      this.getView().getModel("wizardModel").setProperty("/addressValidated", true);
      this._updatePendingActionText();
      MessageToast.show("Selected: " + oAddrObj.formatted);
    },

    onEnterNewAddressInWizard: function () {
      var oAddressesModel = this.getModel("addresses");
      var aAddresses = oAddressesModel.getData() || [];
      var oNewAddr = {
        id: "addr-" + (aAddresses.length + 1),
        street: "88 Grayston Drive",
        city: "Sandton",
        postalCode: "2196",
        region: "Gauteng",
        country: "South Africa",
        formatted: "88 Grayston Drive, Sandton, 2196, Gauteng",
        status: "NEW",
        statusState: "Information",
        note: "Newly entered customer address",
        isDefault: true
      };
      aAddresses.unshift(oNewAddr);
      oAddressesModel.setData(aAddresses);
      this.getModel("appState").setProperty("/customer/address", oNewAddr);
      this.getView().getModel("wizardModel").setProperty("/addressValidated", true);
      this._updatePendingActionText();
      MessageToast.show("New address entered (Status: NEW)");
    },

    onEditAddressInWizard: function () {
      var oAddressesModel = this.getModel("addresses");
      var aAddresses = oAddressesModel.getData() || [];
      if (aAddresses.length > 0) {
        aAddresses[0].street = "12 Rivonia Road, Suite 402";
        aAddresses[0].formatted = "12 Rivonia Road, Suite 402, Sandton, 2196, Gauteng";
        aAddresses[0].status = "MODIFIED";
        aAddresses[0].statusState = "Warning";
        aAddresses[0].note = "Modified by agent: Suite number added";
        oAddressesModel.setData(aAddresses);
        this.getModel("appState").setProperty("/customer/address", aAddresses[0]);
        this.getView().getModel("wizardModel").setProperty("/addressValidated", true);
        this._updatePendingActionText();
        MessageToast.show("Address modified (Status: MODIFIED)");
      }
    },

    onExecuteCreateCustomer: function () {
      var oAppState = this.getModel("appState");
      var oCustomer = oAppState.getProperty("/customer") || {};
      var sType = oCustomer.type || "Individual";

      // Form validation
      if (!this._validateBasicDetailsForm(false)) {
        return;
      }

      // Check address
      if (!oCustomer.address || !oCustomer.address.formatted) {
        MessageBox.warning("Please validate or select an address before creating customer.");
        return;
      }

      // Customer name computation
      var sName = "";
      if (sType === "Company") {
        sName = (oCustomer.companyName || "New Company").trim();
      } else {
        sName = ((oCustomer.firstName || "") + " " + (oCustomer.lastName || "")).trim() || "New Customer";
      }

      // Generate Business Partner Number (e.g. 10002xxxxx)
      var sBp = "10002" + Math.floor(10000 + Math.random() * 90000);
      oCustomer.bpNumber = sBp;
      oCustomer.name = sName;

      oAppState.setProperty("/customer", oCustomer);
      oAppState.setProperty("/orderHeader/soldToParty", sBp + " - " + sName);
      oAppState.setProperty("/orderHeader/shipToParty", sBp + " - " + sName);
      oAppState.setProperty("/delivery/address", oCustomer.address);

      // Save customer to the customers model list
      var oCustomersModel = this.getModel("customers");
      if (oCustomersModel) {
        var aCustomers = oCustomersModel.getData() || [];
        aCustomers.unshift(JSON.parse(JSON.stringify(oCustomer)));
        oCustomersModel.setData(aCustomers);
      }

      // Update wizard model state
      var oWizardModel = this.getView().getModel("wizardModel");
      oWizardModel.setProperty("/customerSelected", true);
      oWizardModel.setProperty("/isCreatingNewCustomer", false);
      oWizardModel.setProperty("/isNewlyCreatedCustomer", true);
      oWizardModel.setProperty("/searchPanelExpanded", false);

      // Validate Step 1 so Step 2 button is activated
      var oStepCustomer = this.byId("stepCustomer");
      if (oStepCustomer) {
        oStepCustomer.setValidated(true);
      }
      var oWizard = this.byId("salesOrderWizard");
      if (oWizard && oStepCustomer) {
        oWizard.validateStep(oStepCustomer);
      }

      MessageToast.show("New customer " + sName + " (BP " + sBp + ") created successfully!");
    },

    onChangeCustomerClick: function () {
      var oWizardModel = this.getView().getModel("wizardModel");
      oWizardModel.setProperty("/searchPanelExpanded", true);
      this.onSearchCustomerClick();
    },

    // ========================================================
    // STEP 2: MARKETING INFORMATION & STEP 3 ACTIVATION
    // ========================================================
    onMarketToYouChange: function (oEvent) {
      var sKey = oEvent.getParameter("selectedItem") ? oEvent.getParameter("selectedItem").getKey() : "";
      this.getModel("appState").setProperty("/marketing/marketToYou", sKey);
      var oStepConsent = this.byId("stepConsent");
      var oWizard = this.byId("salesOrderWizard");
      var bValid = !!sKey;
      if (oStepConsent) {
        oStepConsent.setValidated(bValid);
        if (oWizard) {
          if (bValid) {
            oWizard.validateStep(oStepConsent);
          } else {
            oWizard.invalidateStep(oStepConsent);
          }
        }
      }
    },

    // ========================================================
    // STEP 4: ORDER TYPE
    // ========================================================
    onOrderTypeChange: function (oEvent) {
      var sKey = oEvent.getParameter("selectedItem").getKey();
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/orderHeader/orderType", sKey);
      if (sKey === "ZOR") {
        oAppState.setProperty("/orderHeader/orderTypeName", "Standard Store Order");
        oAppState.setProperty("/orderHeader/orderTypeDesc", "ZOR · Take-away / collect today");
      } else if (sKey === "ZDL") {
        oAppState.setProperty("/orderHeader/orderTypeName", "Delivery Order");
        oAppState.setProperty("/orderHeader/orderTypeDesc", "ZDL · Deliver to customer");
      } else if (sKey === "ZSP") {
        oAppState.setProperty("/orderHeader/orderTypeName", "Special / Supply Order");
        oAppState.setProperty("/orderHeader/orderTypeDesc", "ZSP · Warehouse Supply");
      }
    },

    onSelectOrderTypeZOR: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/orderHeader/orderType", "ZOR");
      oAppState.setProperty("/orderHeader/orderTypeName", "Standard Store Order");
      oAppState.setProperty("/orderHeader/orderTypeDesc", "ZOR · Take-away / collect today");
    },

    onSelectOrderTypeZDL: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/orderHeader/orderType", "ZDL");
      oAppState.setProperty("/orderHeader/orderTypeName", "Delivery Order");
      oAppState.setProperty("/orderHeader/orderTypeDesc", "ZDL · Deliver to customer");
    },

    onSelectOrderTypeZSP: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/orderHeader/orderType", "ZSP");
      oAppState.setProperty("/orderHeader/orderTypeName", "Special / Supply Order");
      oAppState.setProperty("/orderHeader/orderTypeDesc", "ZSP · Warehouse Supply");
    },

    // ========================================================
    // STEP 5: PRODUCTS & CART
    // ========================================================
    onLiveSearchProducts: function () {
      this._applyProductFilters();
    },

    onCategoryFilterChange: function () {
      this._applyProductFilters();
    },

    _applyProductFilters: function () {
      var oWizardModel = this.getView().getModel("wizardModel");
      var sQuery = (oWizardModel.getProperty("/productSearchQuery") || "").trim();
      var sCategory = oWizardModel.getProperty("/selectedCategory");
      var aFilters = [];

      if (sQuery) {
        aFilters.push(new Filter({
          filters: [
            new Filter("name", FilterOperator.Contains, sQuery),
            new Filter("articleId", FilterOperator.Contains, sQuery)
          ],
          and: false
        }));
      }

      if (sCategory && sCategory !== "All") {
        aFilters.push(new Filter("category", FilterOperator.EQ, sCategory));
      }
    },

    onOpenAddArticleDialog: function () {
      var oView = this.getView();
      var that = this;

      this.getView().getModel("wizardModel").setProperty("/productSearchQuery", "");

      var oExistingDialog = this.byId("addArticleDialog");
      if (oExistingDialog) {
        var oTable = Fragment.byId(oView.getId(), "selectProductTable");
        if (oTable && oTable.getBinding("items")) {
          oTable.getBinding("items").filter([]);
          if (oTable.removeSelections) {
            oTable.removeSelections(true);
          }
        }
        oExistingDialog.open();
        return;
      }

      if (!this._pAddArticleDialog) {
        this._pAddArticleDialog = Fragment.load({
          id: oView.getId(),
          name: "sap.ui.salesorder.store.view.fragments.AddArticleDialog",
          controller: this
        }).then(function (oDialog) {
          oView.addDependent(oDialog);
          return oDialog;
        }).catch(function (oErr) {
          that._pAddArticleDialog = null;
          console.error("Error loading AddArticleDialog:", oErr);
          MessageToast.show("Failed to open Select Product dialog: " + (oErr.message || oErr));
        });
      }

      if (this._pAddArticleDialog) {
        this._pAddArticleDialog.then(function (oDialog) {
          if (oDialog) {
            var oTable = Fragment.byId(oView.getId(), "selectProductTable");
            if (oTable && oTable.getBinding("items")) {
              oTable.getBinding("items").filter([]);
              if (oTable.removeSelections) {
                oTable.removeSelections(true);
              }
            }
            oDialog.open();
          }
        });
      }
    },

    onCloseAddArticleDialog: function () {
      var oExistingDialog = this.byId("addArticleDialog");
      if (oExistingDialog) {
        oExistingDialog.close();
      } else if (this._pAddArticleDialog) {
        this._pAddArticleDialog.then(function (oDialog) {
          if (oDialog) {
            oDialog.close();
          }
        });
      }
    },

    onLiveSearchDialogProducts: function (oEvent) {
      var sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
      var aFilters = [];
      if (sQuery && sQuery.trim().length > 0) {
        sQuery = sQuery.trim();
        aFilters.push(new Filter({
          filters: [
            new Filter("name", FilterOperator.Contains, sQuery),
            new Filter("articleId", FilterOperator.Contains, sQuery),
            new Filter("category", FilterOperator.Contains, sQuery),
            new Filter("site", FilterOperator.Contains, sQuery),
            new Filter("itemCat", FilterOperator.Contains, sQuery)
          ],
          and: false
        }));
      }
      var oTable = Fragment.byId(this.getView().getId(), "selectProductTable");
      if (oTable) {
        var oBinding = oTable.getBinding("items");
        if (oBinding) oBinding.filter(aFilters);
      }
    },

    onSelectProductFromDialogRow: function (oEvent) {
      var oTable = oEvent.getSource();
      var oListItem = oEvent.getParameter("listItem");
      if (!oListItem && oTable && oTable.getSelectedItem) {
        oListItem = oTable.getSelectedItem();
      }
      if (oListItem) {
        var oProduct = oListItem.getBindingContext("products").getObject();
        this._addProductObjectToCart(oProduct);
      }
      if (oTable && oTable.removeSelections) {
        oTable.removeSelections(true);
      }
    },

    onAddProductToCartDirect: function (oEvent) {
      var oButton = oEvent.getSource();
      var oProduct = oButton.getBindingContext("products").getObject();
      this._addProductObjectToCart(oProduct);
      var oTable = Fragment.byId(this.getView().getId(), "selectProductTable");
      if (oTable && oTable.removeSelections) {
        oTable.removeSelections(true);
      }
    },

    _addProductObjectToCart: function (oProduct) {
      if (!oProduct) return;
      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];
      var nSelectedQty = 1;

      var oExisting = null;
      for (var i = 0; i < aCart.length; i++) {
        if (aCart[i].articleId === oProduct.articleId && !aCart[i].isSubItem && aCart[i].site === oProduct.site) {
          oExisting = aCart[i];
          break;
        }
      }

      if (oExisting) {
        oExisting.qty += nSelectedQty;
        oExisting.targetQty = oExisting.qty;
        oExisting.itemPrice = +(oExisting.qty * oExisting.netPrice).toFixed(2);
        oExisting.netValue = oExisting.itemPrice;
      } else {
        var nItemNo = (aCart.filter(function(it){ return !it.isSubItem; }).length + 1) * 10;
        var oNewItem = {
          item: String(nItemNo),
          articleId: oProduct.articleId,
          targetQty: nSelectedQty,
          qty: nSelectedQty,
          um: "EA",
          description: oProduct.name,
          name: oProduct.name,
          productNo: "PRD-" + oProduct.articleId,
          valueAdds: "-",
          pricePerUnit: oProduct.price,
          netPrice: oProduct.price,
          itemPrice: +(nSelectedQty * oProduct.price).toFixed(2),
          netValue: +(nSelectedQty * oProduct.price).toFixed(2),
          salesPersonId: "SP-1042",
          site: oProduct.site || "M001",
          itemCat: oProduct.itemCat || "TAN",
          extendedGuarantee: "-",
          rejReason: "-",
          discountPct: 0,
          hasCondition: false,
          conditionText: "",
          isSubItem: false
        };
        aCart.push(oNewItem);

        // Auto-propose value added items if any
        if (oProduct.hasEgp) {
          aCart.push({
            item: nItemNo + ".1",
            articleId: oProduct.egpArticle,
            targetQty: nSelectedQty,
            qty: nSelectedQty,
            um: "EA",
            description: oProduct.egpName,
            name: oProduct.egpName,
            subText: "value-added to item " + nItemNo,
            productNo: "SRV-0024",
            valueAdds: "Warranty",
            pricePerUnit: oProduct.egpPrice,
            netPrice: oProduct.egpPrice,
            itemPrice: +(nSelectedQty * oProduct.egpPrice).toFixed(2),
            netValue: +(nSelectedQty * oProduct.egpPrice).toFixed(2),
            salesPersonId: "SP-1042",
            site: oProduct.site || "M001",
            itemCat: "ZSRV",
            extendedGuarantee: "Yes",
            rejReason: "-",
            discountPct: 0,
            hasCondition: false,
            conditionText: "",
            isSubItem: true,
            parentItem: String(nItemNo)
          });
        }
      }

      oAppState.setProperty("/cart", aCart);
      oAppState.setProperty("/cartCount", aCart.length);
      this.recalculateTotals();

      var oStepProducts = this.byId("stepProducts");
      if (oStepProducts) {
        oStepProducts.setValidated(aCart.length > 0);
      }
      var oWizard = this.byId("salesOrderWizard");
      if (oWizard && oStepProducts && aCart.length > 0) {
        oWizard.validateStep(oStepProducts);
      }

      // Close dialog immediately upon selection
      this.onCloseAddArticleDialog();

      MessageToast.show("Added " + oProduct.name + " (" + oProduct.articleId + ") to Cart");
    },

    onIncreaseQty: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      var oItem = oContext.getObject();
      oItem.qty = (oItem.qty || 1) + 1;

      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];
      if (!oItem.isSubItem) {
        aCart.forEach(function (sub) {
          if (sub.isSubItem && sub.parentItem === oItem.item) {
            sub.qty = oItem.qty;
          }
        });
      }
      this.recalculateTotals();
    },

    onDecreaseQty: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      var oItem = oContext.getObject();
      if (oItem.qty > 1) {
        oItem.qty -= 1;
        var oAppState = this.getModel("appState");
        var aCart = oAppState.getProperty("/cart") || [];
        if (!oItem.isSubItem) {
          aCart.forEach(function (sub) {
            if (sub.isSubItem && sub.parentItem === oItem.item) {
              sub.qty = oItem.qty;
            }
          });
        }
        this.recalculateTotals();
      }
    },

    // ========================================================
    // PRICE OVERRIDE POPUP (From Item Price Link)
    // ========================================================
    onOpenPriceOverrideDialog: function (oEvent) {
      var oSource = oEvent.getSource();
      var oContext = oSource.getBindingContext("appState");
      if (!oContext) return;
      var oItem = oContext.getObject();
      this._priceOverrideItem = oItem;
      this._priceOverrideContext = oContext;

      var oPriceOverrideModel = this.getView().getModel("priceOverrideModel");
      if (!oPriceOverrideModel) {
        oPriceOverrideModel = new JSONModel({});
        this.getView().setModel(oPriceOverrideModel, "priceOverrideModel");
      }

      var currentPrice = oItem.netPrice !== undefined ? oItem.netPrice : (oItem.pricePerUnit || 0);
      oPriceOverrideModel.setData({
        itemNo: oItem.item,
        itemName: oItem.name || oItem.description,
        managerAuth: "",
        currentPrice: currentPrice,
        newPrice: (currentPrice % 1 === 0) ? String(currentPrice) : String(currentPrice)
      });

      this._openPriceOverridePopup();
    },

    _openPriceOverridePopup: function () {
      var oView = this.getView();
      var that = this;

      var oExistingDialog = this.byId("priceOverrideDialog");
      if (oExistingDialog) {
        oExistingDialog.open();
        return;
      }

      if (!this._pPriceOverrideDialog) {
        this._pPriceOverrideDialog = Fragment.load({
          id: oView.getId(),
          name: "sap.ui.salesorder.store.view.fragments.PriceOverrideDialog",
          controller: this
        }).then(function (oDialog) {
          oView.addDependent(oDialog);
          return oDialog;
        }).catch(function (oErr) {
          that._pPriceOverrideDialog = null;
          console.error("Error loading PriceOverrideDialog:", oErr);
          MessageToast.show("Failed to open Price Override popup: " + (oErr.message || oErr));
        });
      }

      if (this._pPriceOverrideDialog) {
        this._pPriceOverrideDialog.then(function (oDialog) {
          if (oDialog) {
            oDialog.open();
          }
        });
      }
    },

    onCancelPriceOverride: function () {
      var oExistingDialog = this.byId("priceOverrideDialog");
      if (oExistingDialog) {
        oExistingDialog.close();
      } else if (this._pPriceOverrideDialog) {
        this._pPriceOverrideDialog.then(function (oDialog) {
          if (oDialog) {
            oDialog.close();
          }
        });
      }
    },

    onConfirmPriceOverride: function () {
      var oPriceOverrideModel = this.getView().getModel("priceOverrideModel");
      if (!oPriceOverrideModel) return;
      var sNewPrice = oPriceOverrideModel.getProperty("/newPrice");
      if (sNewPrice === undefined || sNewPrice === null || String(sNewPrice).trim() === "") {
        MessageBox.warning("Please enter a new sales price.");
        return;
      }

      var fNewPrice = parseFloat(sNewPrice);
      if (isNaN(fNewPrice) || fNewPrice < 0) {
        MessageBox.warning("Please enter a valid numeric sales price.");
        return;
      }

      var oItem = this._priceOverrideItem;
      if (!oItem && this._priceOverrideContext) {
        oItem = this._priceOverrideContext.getObject();
      }

      if (oItem) {
        var oAppState = this.getModel("appState");
        var aCart = oAppState.getProperty("/cart") || [];
        var nQty = parseInt(oItem.qty, 10) || 1;

        // Override existing line item price
        oItem.netPrice = fNewPrice;
        oItem.pricePerUnit = fNewPrice;
        oItem.itemPrice = +(nQty * fNewPrice).toFixed(2);
        oItem.netValue = oItem.itemPrice;

        oAppState.setProperty("/cart", aCart);
        this.recalculateTotals();

        MessageToast.show("Price overridden to " + fNewPrice.toFixed(2) + " for Item " + oItem.item);
      }

      this.onCancelPriceOverride();
    },

    onOpenAddCondition: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      var oItem = oContext.getObject();
      var that = this;

      MessageBox.confirm("Apply promotional discount to '" + oItem.name + "'?\n\n- Campaign Discount: 10% off", {
        title: "Add Price Condition",
        actions: ["Apply 10% Discount", MessageBox.Action.CANCEL],
        emphasizedAction: "Apply 10% Discount",
        onClose: function (sAction) {
          if (sAction === "Apply 10% Discount") {
            oItem.hasCondition = true;
            oItem.discountPct = 10;
            oItem.conditionText = "Discount -10%";
            that.recalculateTotals();
            MessageToast.show("Condition added: -10% discount applied to item " + oItem.item);
          }
        }
      });
    },

    onRemoveCartItem: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      if (!oContext) {
        return;
      }
      var oItem = oContext.getObject();
      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];
      var that = this;
      var sItemDesc = oItem.description || oItem.name || ("Item " + oItem.item);

      MessageBox.confirm("Are you sure you want to delete line item " + oItem.item + " (" + sItemDesc + ")?", {
        title: "Delete Line Item",
        actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
        emphasizedAction: MessageBox.Action.DELETE,
        onClose: function (sAction) {
          if (sAction === MessageBox.Action.DELETE) {
            var aFiltered = aCart.filter(function (it) {
              return it.item !== oItem.item && it.parentItem !== oItem.item;
            });
            oAppState.setProperty("/cart", aFiltered);
            oAppState.setProperty("/cartCount", aFiltered.length);
            that.recalculateTotals();
            var oStepProducts = that.byId("stepProducts");
            if (oStepProducts) {
              oStepProducts.setValidated(aFiltered.length > 0);
            }
            MessageToast.show("Line item " + oItem.item + " deleted from cart");
          }
        }
      });
    },

    onRejectionReasonChange: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      if (!oContext) {
        return;
      }
      var oItem = oContext.getObject();
      var sKey = oEvent.getParameter("selectedItem") ? oEvent.getParameter("selectedItem").getKey() : "";
      var sText = oEvent.getParameter("selectedItem") ? oEvent.getParameter("selectedItem").getText() : "";
      if (sKey && sKey !== "-") {
        MessageToast.show("Rejection reason set: " + sText + " for Item " + oItem.item);
      } else {
        MessageToast.show("Rejection reason cleared for Item " + oItem.item);
      }
    },

    onCartTabSelect: function (oEvent) {
      var sKey = oEvent.getParameter("key") || oEvent.getSource().getSelectedKey();
      this.getModel("appState").setProperty("/cartTab", sKey);
    },

    onAddConditionRow: function () {
      var oAppState = this.getModel("appState");
      var aConditions = oAppState.getProperty("/conditions") || [];
      aConditions.push({
        id: "cond-" + Date.now(),
        conditionType: "",
        amount: "",
        per: "1 EA",
        value: ""
      });
      oAppState.setProperty("/conditions", aConditions);
      MessageToast.show("New condition row added");
    },

    onDeleteConditionRow: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      if (!oContext) {
        return;
      }
      var sPath = oContext.getPath();
      var iIndex = parseInt(sPath.split("/").pop(), 10);
      var oAppState = this.getModel("appState");
      var aConditions = oAppState.getProperty("/conditions") || [];
      aConditions.splice(iIndex, 1);
      oAppState.setProperty("/conditions", aConditions);
      MessageToast.show("Condition row deleted");
    },

    // ========================================================
    // VALUE-ADD POPUP & ADD-ON SELECTION
    // ========================================================
    onOpenValueAddPopup: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      this._selectedParentCartItem = oContext ? oContext.getObject() : null;
      var sMainArticle = (this._selectedParentCartItem && this._selectedParentCartItem.articleId) || "HT-1000";

      // Products from user screenshot
      var aAddonProducts = [
        { mainArticle: sMainArticle, addonArticle: "AD-1001", description: "Extended Warranty - 1 Year", price: "49.99" },
        { mainArticle: sMainArticle, addonArticle: "AD-1002", description: "Protective Carry Case", price: "24.5" },
        { mainArticle: sMainArticle, addonArticle: "AD-1003", description: "Wireless Charging Station", price: "79" },
        { mainArticle: sMainArticle, addonArticle: "AD-1004", description: "Premium Support Package", price: "99.99" },
        { mainArticle: sMainArticle, addonArticle: "AD-1005", description: "Replacement Power Adapter", price: "19.95" }
      ];

      var oValueAddModel = this.getView().getModel("valueAddModel");
      if (!oValueAddModel) {
        oValueAddModel = new JSONModel({ items: aAddonProducts, allItems: aAddonProducts });
        this.getView().setModel(oValueAddModel, "valueAddModel");
      } else {
        oValueAddModel.setProperty("/items", aAddonProducts);
        oValueAddModel.setProperty("/allItems", aAddonProducts);
      }

      var oView = this.getView();
      var that = this;

      if (!this._pValueAddDialog) {
        this._pValueAddDialog = Fragment.load({
          id: oView.getId(),
          name: "sap.ui.salesorder.store.view.fragments.ValueAddDialog",
          controller: this
        }).then(function (oDialog) {
          oView.addDependent(oDialog);
          return oDialog;
        });
      }

      this._pValueAddDialog.then(function (oDialog) {
        var oTable = Fragment.byId(oView.getId(), "valueAddTable");
        if (oTable) {
          oTable.removeSelections(true);
        }
        var oSearchField = Fragment.byId(oView.getId(), "valueAddSearchField");
        if (oSearchField) {
          oSearchField.setValue("");
        }
        oDialog.open();
      });
    },

    onLiveSearchValueAdd: function (oEvent) {
      var sValue = (oEvent.getParameter("newValue") || "").toLowerCase().trim();
      var oModel = this.getView().getModel("valueAddModel");
      var aAll = oModel.getProperty("/allItems") || [];
      if (!sValue) {
        oModel.setProperty("/items", aAll);
      } else {
        var aFiltered = aAll.filter(function (it) {
          return it.addonArticle.toLowerCase().indexOf(sValue) !== -1 ||
                 it.description.toLowerCase().indexOf(sValue) !== -1 ||
                 it.mainArticle.toLowerCase().indexOf(sValue) !== -1;
        });
        oModel.setProperty("/items", aFiltered);
      }
    },

    onConfirmValueAddSelection: function () {
      var oView = this.getView();
      var oTable = Fragment.byId(oView.getId(), "valueAddTable");
      var aSelected = oTable ? oTable.getSelectedItems() : [];

      if (!aSelected || aSelected.length === 0) {
        MessageToast.show("Please select at least one add-on item.");
        return;
      }

      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];
      var oParent = this._selectedParentCartItem;
      var sParentItem = oParent ? oParent.item : "10";
      var nParentQty = (oParent && oParent.qty) ? oParent.qty : 1;

      // Find highest sub-item index for this parent
      var nSubIndex = 1;
      aCart.forEach(function (it) {
        if (it.parentItem === sParentItem && it.item.indexOf(".") !== -1) {
          var nIdx = parseInt(it.item.split(".")[1], 10);
          if (!isNaN(nIdx) && nIdx >= nSubIndex) {
            nSubIndex = nIdx + 1;
          }
        }
      });

      // Find parent index in cart
      var nParentIndex = -1;
      for (var i = 0; i < aCart.length; i++) {
        if (aCart[i].item === sParentItem) {
          nParentIndex = i;
          break;
        }
      }

      var aNewItems = [];
      for (var j = 0; j < aSelected.length; j++) {
        var oAddon = aSelected[j].getBindingContext("valueAddModel").getObject();
        var sItemNum = sParentItem + "." + (nSubIndex++);
        var fPrice = parseFloat(oAddon.price) || 0;
        var fTotal = +(fPrice * nParentQty).toFixed(2);

        var oNewItem = {
          item: sItemNum,
          articleId: oAddon.addonArticle,
          targetQty: nParentQty,
          qty: nParentQty,
          um: "EA",
          description: oAddon.description,
          name: oAddon.description,
          productNo: "PRD-" + oAddon.addonArticle,
          valueAdds: "-",
          pricePerUnit: fPrice,
          netPrice: fPrice,
          itemPrice: fTotal,
          netValue: fTotal,
          salesPersonId: (oParent && oParent.salesPersonId) || "SP-1042",
          site: (oParent && oParent.site) || "S101",
          itemCat: "ZSRV",
          extendedGuarantee: oAddon.addonArticle.indexOf("1001") !== -1 ? oAddon.addonArticle : "-",
          rejReason: "-",
          discountPct: 0,
          hasCondition: false,
          conditionText: "",
          isSubItem: true,
          isValueAdd: true,
          parentItem: sParentItem
        };
        aNewItems.push(oNewItem);
      }

      // Insert directly after parent/existing sub-items
      if (nParentIndex !== -1) {
        var nInsertAt = nParentIndex + 1;
        while (nInsertAt < aCart.length && aCart[nInsertAt].parentItem === sParentItem) {
          nInsertAt++;
        }
        for (var k = 0; k < aNewItems.length; k++) {
          aCart.splice(nInsertAt + k, 0, aNewItems[k]);
        }
      } else {
        aNewItems.forEach(function (it) { aCart.push(it); });
      }

      oAppState.setProperty("/cart", aCart);
      this.recalculateTotals();

      if (this._pValueAddDialog) {
        this._pValueAddDialog.then(function (oDialog) {
          oDialog.close();
        });
      }

      MessageToast.show(aNewItems.length + " add-on item(s) added to cart");
    },

    onCloseValueAddDialog: function () {
      if (this._pValueAddDialog) {
        this._pValueAddDialog.then(function (oDialog) {
          oDialog.close();
        });
      }
    },

    // ========================================================
    // STEP 6: DELIVERY
    // ========================================================
    onSelectDeliveryMethodToCustomer: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/methodKey", "DELIVERY");
      oAppState.setProperty("/delivery/methodTitle", "Delivery to Customer");
    },

    onSelectInStoreCollection: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/methodKey", "COLLECTION");
      oAppState.setProperty("/delivery/methodTitle", "In-Store Collection");
    },

    onSelectWarehousePickup: function () {
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/methodKey", "WAREHOUSE");
      oAppState.setProperty("/delivery/methodTitle", "Warehouse Pickup");
    },

    onPayeeSelectChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (oItem) {
        var sKey = oItem.getKey();
        var sText = oItem.getText();
        var oAppState = this.getModel("appState");
        oAppState.setProperty("/delivery/payee", sKey);
        oAppState.setProperty("/delivery/payeeText", sText);
        oAppState.setProperty("/review/shippingDetails/payee", sText);
      }
    },

    onShipToSelectChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (!oItem) {
        return;
      }
      var sKey = oItem.getKey();
      var sText = oItem.getText();
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/shipTo", sKey);
      oAppState.setProperty("/delivery/shipToName", sText);
      oAppState.setProperty("/review/shippingDetails/shipTo", sText);

      var mAddresses = {
        "1000234571": {
          street: "12 Rivonia Road",
          city: "Sandton",
          state: "Gauteng",
          postalCode: "2196",
          country: "South Africa",
          phone: "+27 82 555 0192"
        },
        "1000234588": {
          street: "88 Sandton Drive",
          city: "Sandton",
          state: "Gauteng",
          postalCode: "2196",
          country: "South Africa",
          phone: "+27 11 884 9000"
        },
        "1000234599": {
          street: "50 Oxford Road",
          city: "Rosebank",
          state: "Gauteng",
          postalCode: "2196",
          country: "South Africa",
          phone: "+27 11 788 4321"
        }
      };

      if (mAddresses[sKey]) {
        oAppState.setProperty("/delivery/shipToAddress", mAddresses[sKey]);
        oAppState.setProperty("/review/shippingDetails/phoneNumber", mAddresses[sKey].phone);
      }
      MessageToast.show("Ship to updated: " + sText);
    },

    onBillToSelectChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (!oItem) {
        return;
      }
      var sKey = oItem.getKey();
      var sText = oItem.getText();
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/billTo", sKey);
      oAppState.setProperty("/delivery/billToName", sText);
      oAppState.setProperty("/review/billingDetails/billTo", sText);
      MessageToast.show("Bill to updated: " + sText);
    },

    onRequestedDeliveryDateChange: function (oEvent) {
      var sValue = oEvent.getParameter("value");
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/requestedDeliveryDate", sValue);
      oAppState.setProperty("/review/shippingDetails/requestedDeliveryDate", sValue);
      MessageToast.show("Requested delivery date: " + sValue);
    },

    onSingleShipmentChange: function (oEvent) {
      var bState = oEvent.getParameter("state");
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/singleShipment", bState);
      oAppState.setProperty("/review/shippingDetails/singleShipment", bState ? "Yes" : "No");
      MessageToast.show("Single shipment: " + (bState ? "Yes" : "No"));
    },

    onCarrierChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (oItem) {
        var sText = oItem.getText();
        var oAppState = this.getModel("appState");
        oAppState.setProperty("/delivery/carrier", sText);
        oAppState.setProperty("/review/shippingDetails/carrier", sText);
        MessageToast.show("Carrier selected: " + sText);
      }
    },

    onShippingMethodChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (oItem) {
        var sText = oItem.getText();
        var oAppState = this.getModel("appState");
        oAppState.setProperty("/delivery/shipping", sText);
        oAppState.setProperty("/review/shippingDetails/shipping", sText);
        MessageToast.show("Shipping method: " + sText);
      }
    },

    onIncotermsChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (oItem) {
        var sText = oItem.getText();
        var oAppState = this.getModel("appState");
        oAppState.setProperty("/delivery/incoterms", sText);
        oAppState.setProperty("/review/shippingDetails/incoterms", sText);
        MessageToast.show("Incoterms: " + sText);
      }
    },

    onFileSizeExceed: function (oEvent) {
      MessageBox.error("File size cannot exceed 2 MB. Please choose a smaller file.", {
        title: "File Size Limit Exceeded"
      });
      var oUploader = oEvent.getSource();
      if (oUploader && typeof oUploader.clear === "function") {
        oUploader.clear();
      }
    },

    onFileSelected: function (oEvent) {
      var oUploader = oEvent.getSource();
      var aFiles = oEvent.getParameter("files");
      var oFile = (aFiles && aFiles.length > 0)
        ? aFiles[0]
        : (oUploader.getDomRef && oUploader.getDomRef("fu") && oUploader.getDomRef("fu").files ? oUploader.getDomRef("fu").files[0] : null);

      if (!oFile) {
        return;
      }

      // 2MB size restriction (2 * 1024 * 1024 bytes)
      var MAX_SIZE = 2 * 1024 * 1024;
      if (oFile.size > MAX_SIZE) {
        var nSizeMb = (oFile.size / (1024 * 1024)).toFixed(2);
        MessageBox.error("File size exceeds 2MB limit. The selected file is " + nSizeMb + " MB.", {
          title: "File Size Limit Exceeded"
        });
        if (oUploader && typeof oUploader.clear === "function") {
          oUploader.clear();
        }
        return;
      }

      var that = this;
      var oReader = new FileReader();
      oReader.onload = function (e) {
        var sDataUrl = e.target.result;
        var sFileName = oFile.name;
        var isPdf = sFileName.toLowerCase().endsWith(".pdf") || oFile.type === "application/pdf";
        var sSizeFormatted = oFile.size >= 1024 * 1024
          ? (oFile.size / (1024 * 1024)).toFixed(1) + " MB"
          : (oFile.size / 1024).toFixed(1) + " KB";

        var sBase64Data = "";
        if (typeof sDataUrl === "string" && sDataUrl.indexOf(",") !== -1) {
          sBase64Data = sDataUrl.split(",")[1];
        } else {
          sBase64Data = sDataUrl || "";
        }

        var sFileType = oFile.type || "";
        if (!sFileType && sFileName.indexOf(".") !== -1) {
          sFileType = sFileName.split(".").pop().toUpperCase();
        }
        if (sFileType.length > 20) {
          sFileType = sFileType.substring(0, 20);
        }

        var dNow = new Date();
        var sFormattedDate = (dNow.getMonth() + 1) + "/" + dNow.getDate() + "/" + dNow.getFullYear();

        var oNewAttachment = {
          AttaId: sFileName,
          Descr: sFileName,
          FileData: sBase64Data,
          id: sFileName,
          fileName: sFileName,
          name: sFileName,
          fileSize: sSizeFormatted,
          size: sSizeFormatted,
          fileType: sFileType,
          uploadDate: sFormattedDate,
          isPdf: isPdf,
          url: sDataUrl
        };

        that._addAttachmentLocally(oNewAttachment);
        MessageToast.show("Attachment added: " + sFileName);

        if (oUploader && typeof oUploader.clear === "function") {
          oUploader.clear();
        }
      };

      oReader.readAsDataURL(oFile);
    },

    _addAttachmentLocally: function (oNewAttachment) {
      var oAppState = this.getModel("appState");
      if (oAppState) {
        var aAttachments = oAppState.getProperty("/delivery/attachments") || [];
        var bExists = aAttachments.some(function (att) {
          return (att.fileName === oNewAttachment.fileName) || (att.AttaId === oNewAttachment.AttaId) || (att.name === oNewAttachment.name);
        });
        if (!bExists) {
          aAttachments.push(oNewAttachment);
          oAppState.setProperty("/delivery/attachments", aAttachments);
          oAppState.setProperty("/attachments", aAttachments);
          oAppState.refresh(true);
        } else {
          MessageToast.show("File with same name already attached.");
        }
      }
    },

    onAttachmentPress: function (oEvent) {
      var oSource = oEvent.getSource();
      var oContext = oSource.getBindingContext("appState") || oSource.getBindingContext("soc_cart") || oSource.getBindingContext();
      var oAttachment = oContext ? oContext.getObject() : null;
      if (!oAttachment) {
        return;
      }

      var sFileName = oAttachment.Descr || oAttachment.fileName || oAttachment.name || oAttachment.AttaId || "attachment";
      var isPdf = oAttachment.isPdf || sFileName.toLowerCase().endsWith(".pdf") || oAttachment.fileType === "application/pdf";

      var sUrl = oAttachment.url;
      if (!sUrl && oAttachment.FileData) {
        if (oAttachment.FileData.startsWith("data:")) {
          sUrl = oAttachment.FileData;
        } else {
          var mime = isPdf ? "application/pdf" : "application/octet-stream";
          sUrl = "data:" + mime + ";base64," + oAttachment.FileData;
        }
      }

      if (isPdf) {
        if (sUrl) {
          if (sUrl.startsWith("data:")) {
            try {
              var parts = sUrl.split(',');
              var mimeMatch = parts[0].match(/:(.*?);/);
              var mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
              var byteCharacters = atob(parts[1]);
              var byteNumbers = new Array(byteCharacters.length);
              for (var i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              var byteArray = new Uint8Array(byteNumbers);
              var blob = new Blob([byteArray], { type: mimeType });
              var blobUrl = URL.createObjectURL(blob);
              var win = window.open(blobUrl, "_blank");
              if (!win) {
                var a = document.createElement("a");
                a.href = blobUrl;
                a.target = "_blank";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
            } catch (err) {
              window.open(sUrl, "_blank");
            }
          } else {
            window.open(sUrl, "_blank");
          }
        } else {
          MessageToast.show("Attachment content is not available.");
        }
      } else {
        if (sUrl) {
          var downloadLink = document.createElement("a");
          downloadLink.href = sUrl;
          downloadLink.download = sFileName;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          MessageToast.show("Downloading " + sFileName);
        } else {
          MessageToast.show("Attachment content is not available.");
        }
      }
    },

    onDeleteAttachment: function (oEvent) {
      var oSource = oEvent.getSource();
      var oContext = oSource.getBindingContext("appState") || oSource.getBindingContext("soc_cart") || oSource.getBindingContext();
      if (!oContext) {
        var oListItem = oEvent.getParameter && oEvent.getParameter("listItem");
        if (oListItem) {
          oContext = oListItem.getBindingContext("appState") || oListItem.getBindingContext("soc_cart") || oListItem.getBindingContext();
        }
      }
      if (!oContext) {
        return;
      }
      var sPath = oContext.getPath();
      var iIndex = parseInt(sPath.split("/").pop(), 10);
      var oAppState = this.getModel("appState");
      var oAttachment = oContext.getObject();
      var sName = oAttachment ? (oAttachment.fileName || oAttachment.name || oAttachment.Descr || "attachment") : "attachment";

      MessageBox.confirm("Are you sure you want to remove '" + sName + "'?", {
        title: "Remove Attachment",
        actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
        emphasizedAction: MessageBox.Action.DELETE,
        onClose: function (sAction) {
          if (sAction === MessageBox.Action.DELETE) {
            var aAttachments = oAppState.getProperty("/delivery/attachments") || [];
            aAttachments.splice(iIndex, 1);
            oAppState.setProperty("/delivery/attachments", aAttachments);
            oAppState.setProperty("/attachments", aAttachments);
            oAppState.refresh(true);
            MessageToast.show("Attachment removed");
          }
        }
      });
    },

    onAttachmentFileChange: function (oEvent) {
      this.onFileSelected(oEvent);
    },

    onTriggerAddAttachment: function () {
      MessageToast.show("Choose a file using Browse to attach.");
    },

    onToggleSameAsBilling: function (oEvent) {
      var bState = oEvent.getParameter("state");
      var oAppState = this.getModel("appState");
      oAppState.setProperty("/delivery/sameAsBilling", bState);

      if (!bState) {
        this.onChangeDifferentAddress();
      } else {
        MessageToast.show("Reusing validated billing address (no second plug-in call)");
      }
      this._updatePendingActionText();
    },

    onChangeDifferentAddress: function () {
      var that = this;
      var oAppState = this.getModel("appState");

      this.openAddressValidationDialog("Ship-To", function (oSelectedAddress) {
        if (oSelectedAddress) {
          var oDiff = {
            street: oSelectedAddress.street,
            city: oSelectedAddress.city,
            postalCode: oSelectedAddress.postalCode,
            region: oSelectedAddress.region,
            formatted: oSelectedAddress.formatted,
            status: oSelectedAddress.status || "MODIFIED",
            statusState: that.formatter.addressStatusState(oSelectedAddress.status),
            note: oSelectedAddress.note || "Selected for ship-to delivery"
          };
          oAppState.setProperty("/delivery/differentAddress", oDiff);
          that._updatePendingActionText();
          MessageToast.show("Ship-to address updated (" + oDiff.status + ")");
        }
      });
    },

    _updatePendingActionText: function () {
      var oAppState = this.getModel("appState");
      var bSame = oAppState.getProperty("/delivery/sameAsBilling");
      var sStatus = bSame
        ? oAppState.getProperty("/customer/address/status")
        : oAppState.getProperty("/delivery/differentAddress/status");

      var sPendingAction = "";
      if (sStatus === "NEW") {
        sPendingAction = "On Create: Create SD Customer and Address (OData) → Create Sales Order";
      } else if (sStatus === "MODIFIED") {
        sPendingAction = "On Create: Update SD Customer Address (OData) → Create Sales Order";
      } else {
        sPendingAction = "On Create: None – Create Sales Order directly";
      }
      oAppState.setProperty("/pendingActionText", sPendingAction);
    },

    // ========================================================
    // STEP 7: REVIEW & ORDER CREATION (Screen 15 & 16)
    // ========================================================
    onWizardComplete: function () {
      this.onCreateSalesOrder();
    },

    onReviewShipmentPriorityChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      var sKey = oItem ? oItem.getKey() : "";
      var oSelect = this.byId("selReviewShipmentPriority");

      if (sKey) {
        if (oSelect) {
          oSelect.setValueState("None");
        }
        var sText = sKey === "01" ? "01 – Immediate" : (sKey === "02" ? "02 – High" : (sKey === "03" ? "03 – Standard" : "04 – Low"));
        this.getModel("appState").setProperty("/orderFinal/shipmentPriority", sKey);
        this.getModel("appState").setProperty("/orderFinal/shipmentPriorityText", sText);
      } else {
        this.getModel("appState").setProperty("/orderFinal/shipmentPriority", "");
        this.getModel("appState").setProperty("/orderFinal/shipmentPriorityText", "");
        if (oSelect) {
          oSelect.setValueState("Error");
          oSelect.setValueStateText("Shipment Priority is mandatory.");
        }
      }
    },

    onCreateSalesOrder: function () {
      var oAppState = this.getModel("appState");
      var sPriority = (oAppState.getProperty("/orderFinal/shipmentPriority") || "").trim();

      // Mandatory validation: trigger error message if priority is not set
      if (!sPriority) {
        var oSelect = this.byId("selReviewShipmentPriority");
        if (oSelect) {
          oSelect.setValueState("Error");
          oSelect.setValueStateText("Shipment Priority is mandatory. Please select a shipment priority.");
        }
        MessageBox.error("Shipment Priority is mandatory. Please select a shipment priority in Shipping Details before creating the sales order.", {
          title: "Validation Error"
        });
        return;
      }

      var sSalesOrderNo = "50000" + Math.floor(10000 + Math.random() * 90000);
      var sShipToBp = oAppState.getProperty("/customer/bpNumber") || "1000234588";
      var sPriorityText = sPriority === "01" ? "01 – Immediate" : (sPriority === "02" ? "02 – High" : (sPriority === "03" ? "03 – Standard" : "04 – Low"));

      oAppState.setProperty("/orderFinal/salesOrderNo", sSalesOrderNo);
      oAppState.setProperty("/orderFinal/shipToBp", sShipToBp);
      oAppState.setProperty("/orderFinal/shipmentPriorityText", sPriorityText);
      oAppState.setProperty("/orderFinal/isSaved", true);

      var that = this;
      MessageBox.success("Sales Order " + sSalesOrderNo + " created successfully.", {
        title: "Sales Order Created",
        actions: [MessageBox.Action.OK],
        emphasizedAction: MessageBox.Action.OK,
        onClose: function () {
          that.onCreateNewOrderReset();
        }
      });
    },

    onCreateNewOrderReset: function () {
      var oNewAppState = models.createAppStateModel();
      this.getOwnerComponent().setModel(oNewAppState, "appState");
      this.getView().setModel(oNewAppState, "appState");

      var oWizardModel = this.getView().getModel("wizardModel");
      oWizardModel.setProperty("/orderCreated", false);
      oWizardModel.setProperty("/showNewCustomerCapture", false);
      oWizardModel.setProperty("/isCreatingNewCustomer", false);
      oWizardModel.setProperty("/customerSelected", false);
      oWizardModel.setProperty("/addressValidated", false);
      oWizardModel.setProperty("/isNewlyCreatedCustomer", false);
      oWizardModel.setProperty("/searchPanelExpanded", true);
      oWizardModel.setProperty("/newCustomerTypeIndex", 0);
      oWizardModel.setProperty("/searchCriteria", {
        customerName: "",
        mobile: "",
        email: "",
        customerNumber: "",
        idNumber: "",
        orderOrAccountNo: "",
        dealNumber: "",
        plusMoreNumber: ""
      });
      oWizardModel.setProperty("/productSearchQuery", "");

      var oWizard = this.byId("salesOrderWizard");
      if (oWizard) {
        var oStep1 = this.byId("stepCustomer");
        if (oStep1) {
          oStep1.setValidated(false);
          oWizard.discardProgress(oStep1);
          oWizard.goToStep(oStep1, true);
        }
        var oStepConsent = this.byId("stepConsent");
        if (oStepConsent) {
          oStepConsent.setValidated(false);
        }
        var oStepProducts = this.byId("stepProducts");
        if (oStepProducts) {
          oStepProducts.setValidated(false);
        }
      }

      var oSelectPriority = this.byId("selReviewShipmentPriority");
      if (oSelectPriority) {
        oSelectPriority.setSelectedKey("");
        oSelectPriority.setValueState("None");
      }

      this.recalculateTotals();
      this._updatePendingActionText();
    }
  });
});
