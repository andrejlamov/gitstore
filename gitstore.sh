#!/bin/bash

STORE_FILE=state.json
INITIAL_COMMIT_FILE=ROOT
GIT_INDEX_FILE=`mktemp -u`

while :
do
    case "$1" in
        -i | --init)
            GIT_DIR="$2"
            shift 2
            ;;
        -c | --commit)
            COMMIT="true"
            shift 1
            ;;
        -p | --parent)
            PARENT="$2"
            shift 2
            ;;
        -b | --branch)
            MAYBE_BRANCH_NAME="$2" #Could be a commit id
            shift 2
            ;;
        -s | --show)
            SHOW="$2"
            shift 2
            ;;
        --) # End of all options
            shift
            break;
            ;;
        -*)
            echo "Error: Unknown option: $1" >&2
            exit 1
            ;;
        *)  # No more options
            break
            ;;
    esac
done

function write_obj()
{
    local obj_id=`git hash-object -w --stdin <&0`
    `git update-index --add --cacheinfo 100644 $obj_id $STORE_FILE`
    local tree_id=`git write-tree`
    local parent=$1
    if [[ "$parent" ]]
    then
        parent="-p $parent"
    fi
    local commit_id=`git commit-tree $tree_id $parent`
    echo $commit_id
}

function init_bare()
{
    if [[ ! -d "$GIT_DIR" ]]
    then
        res=`mkdir $GIT_DIR`
        cd $GIT_DIR
        git init --bare
        local commit_id=`write_obj`
        git update-ref $INITIAL_COMMIT_FILE $commit_id
    fi
}

function main()
{
    if [ $GIT_DIR ]
    then
        init_bare
        exit 0
    fi

    if [ $SHOW ]
    then
        `git rev-parse $SHOW &> /dev/null`

        if [[ "$?" -ne 0 ]]
        then
            SHOW=$INITIAL_COMMIT_FILE
        fi
        local content=`git show $SHOW:$STORE_FILE`
        local id=$SHOW
        echo '{"event":"show", "state":'$content', "ref":"'$id'"}'
        exit 0
    fi

    if [ $COMMIT -a $PARENT ]
    then
        local is_parent=`git show-ref $PARENT`
        if [[ !$is_parent ]]
        then
            PARENT=$INITIAL_COMMIT_FILE
        fi
        COMMIT_ID=`write_obj $PARENT`
        if [ ! $MAYBE_BRANCH_NAME ]
        then
            echo '{"event": "new-ref", "ref": "'$COMMIT_ID'"}'
            exit 0
        fi
    fi

    if [ $MAYBE_BRANCH_NAME ]
    then
        local refhead="refs/heads/$MAYBE_BRANCH_NAME"
        # Test if branchname exists
        local branch_exists=`git show-ref $refhead` || true
        if [[ $branch_exists ]]
        then
            local merge_base=`git merge-base $COMMIT_ID $refhead`
            local id=`git rev-parse $refhead`
            if [[ ("$merge_base" = "$id") ]]
            then
                `git update-ref $refhead $COMMIT_ID`
                echo '{"event": "ff", "ref": "'$MAYBE_BRANCH_NAME'"}'
            else
                echo '{"event": "no-ff", "ref": "'$COMMIT_ID'"}'
            fi
        else
            # Test if it is a valid name for a branch
            local is_id=`git rev-parse --quiet --verify $MAYBE_BRANCH_NAME`
            if [[ $is_id ]]
            then
                # The name was a commit id - not valid
                ref=$COMMIT_ID
            else
                # The name is valid
                `git update-ref $refhead $COMMIT_ID`
                ref=$MAYBE_BRANCH_NAME
            fi
            echo '{"event": "new-ref", "ref": "'$ref'"}'
        fi
    fi
    exit 0
}

main
exit 0
