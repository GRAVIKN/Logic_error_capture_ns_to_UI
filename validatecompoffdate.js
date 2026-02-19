/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/search', 'N/error', 'N/log'], 
function (record, search, error, log) {

    function beforeSubmit(context) {

        if (context.type === context.UserEventType.CREATE) {

            var rec = context.newRecord;

            var empId = rec.getValue({
                fieldId: 'custrecord_pls_eca_name'
            });

            var dt = rec.getValue({
                fieldId: 'custrecord_pls_eca_date'
            });

            log.debug('EmpID', empId);
            log.debug('Date', dt);

            if (!empId || !dt) {
                return; // Skip if required values not present
            }

            var compOffSearch = search.create({
                type: 'customrecord_pls_empcompoffappln',
                filters: [
                    ['custrecord_pls_eca_name', 'anyof', empId],
                    'AND',
                    ['custrecord_pls_eca_date', 'on', dt]
                ],
                columns: [
                    'custrecord_pls_eca_name',
                    'custrecord_pls_eca_date'
                ]
            });

            var results = compOffSearch.run().getRange({
                start: 0,
                end: 1
            });

            log.debug('Results Length', results.length);

            if (results && results.length > 0) {

                throw error.create({
                    name: 'E500',
                    message: 'You have already applied CompOff leave on this day. Please select another date.',
                    notifyOff: false
                });

            }
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});

front end

  self.validationSave = function (str) {
                var isUpdate = (str === 'update');
                var id = $("#hdvalue").val();
                var compoffDate, expdate, compreason, hoursworked, startTime, endTime;

                if (isUpdate) {
                    compoffDate = $("#CompOffapplyDateupdate").val().trim();
                    startTime = $("#startTimeUpdate").val().trim();
                    endTime = $("#endTimeUpdate").val().trim();
                    compreason = $("#CompOffreasonupdate").val().trim();
                    hoursworked = $("#workinghoursupdate").val();
                    expdate = compoffDate;
                } else {
                    compoffDate = $("#CompOffapplyDate").val().trim();
                    expdate = $("#ExpiryCompOffDate").val().trim();
                    startTime = $("#startTime").val().trim();
                    endTime = $("#endTime").val().trim();
                    compreason = $("#CompOffreason").val().trim();
                    hoursworked = $("#hours-worked").val();
                }

                // ── Validate ──
                var isValid = true;
                if (isUpdate) clearAllErrors();

                if (!compoffDate) {
                    if (isUpdate) setFieldError('CompOffapplyDateupdate', 'err-date', true);
                    else toastr.error("Please select the Date of extra work.");
                    isValid = false;
                } else if (isUpdate) {
                    // Validate it's a weekend or public holiday
                    var phList = ["26/01/2025", "15/08/2025", "02/10/2025", "25/12/2025"];
                    var dParts = compoffDate.split('/');
                    if (dParts.length === 3) {
                        var dCheck = new Date(parseInt(dParts[2]), parseInt(dParts[1]) - 1, parseInt(dParts[0]));
                        var dayOfWeek = dCheck.getDay();
                        var isWknd = (dayOfWeek === 0 || dayOfWeek === 6);
                        var isPH = phList.indexOf(compoffDate) !== -1;
                        if (!isWknd && !isPH) {
                            setFieldError('CompOffapplyDateupdate', 'err-date', true);
                            document.getElementById('err-date').textContent = 'Please select a weekend or public holiday date.';
                            toastr.warning("⚠️ Selected date is a weekday. Please choose a weekend or public holiday.");
                            isValid = false;
                        }
                    }
                    // Also compute expiry if not already set
                    if (isValid) {
                        expdate = (function () {
                            var p = compoffDate.split('/');
                            var d = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
                            d.setDate(d.getDate() + 30);
                            return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
                        })();
                    }
                }
                if (isUpdate && !startTime) {
                    setFieldError('startTimeUpdate', 'err-start', true);
                    isValid = false;
                }
                if (isUpdate && !endTime) {
                    setFieldError('endTimeUpdate', 'err-end', true);
                    isValid = false;
                }

                if (!compreason) {
                    if (isUpdate) setFieldError('CompOffreasonupdate', 'err-reason', true);
                    else toastr.error("Please enter reason.");
                    isValid = false;
                }

                if (!isValid) {
                    if (isUpdate) toastr.error("Please fix the highlighted fields.");
                    return false;
                }

                // ── Submit ──
                self.AjaxLoading(true);
                var data = {
                    command: "SaveCompOffLeaveApplication",
                    rec: { applyDate: compoffDate, expdate: expdate, starttym: startTime, endtym: endTime, reason: compreason, workhours: hoursworked },
                    id: id
                };

                self.LoadViaAjax(data, function (result) {
                    self.AjaxLoading(false);
                    alert("result: " + JSON.stringify(result));

                    /* =======================
                       SERVER RESPONSE CHECK important ravi
                    ======================= */

                    if (!result) {
                        toastr.error("No response from server.");
                        return;
                    }

                    /* 🔴 Top level failure */
                    if (!result.success) {
                        toastr.error("Unexpected server error.");
                        return;
                    }

                    /* 🔴 Inner failure (your duplicate case) */
                    if (result.data && result.data.success === false) {

                        var msg = "Unexpected server error.";

                        if (result.data.data &&
                            result.data.data.failed &&
                            result.data.data.failed.length > 0) {

                            msg = result.data.data.failed[0].message.trim();
                        }

                        toastr.error(msg);   // 👉 Shows: Duplicate entry found for the same date.
                        return;              // ⛔ STOP HERE
                    }

                    /* 🔴 Safety check (if failed array exists directly) */
                    if (result.data?.data?.failed?.length > 0) {
                        toastr.error(result.data.data.failed[0].message.trim());
                        return;
                    }

                    /* ✅ SUCCESS CASE */
                    var successMsg = "Comp Off submitted successfully.";

                    if (result.data?.data?.success?.length > 0) {
                        successMsg = result.data.data.success[0].message;
                    }

                    toastr.success(successMsg);

                    closeSubList();
                    // Reset apply-form fields too
                    $("#CompOffapplyDate").val('');
                    $("#CompOffreason").val('');
                    $("#hours-worked").val('');
                    viewModel.LoadCompOffApplList();
                });
            };

